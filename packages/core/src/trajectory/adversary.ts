export * as Adversary from "./adversary"

import { Hash } from "../util/hash"
import { TrajectorySchema } from "./schema"
import { TrajectoryStore } from "./store"
import type { GraphInput } from "./evolution"

export interface PerturbInput {
  readonly graph: GraphInput
  readonly task_class: string
  /** Deterministic seed; perturbations are stable for a given seed. */
  readonly seed?: string
}

/**
 * Adversarial environment generator for graph-differential self-evolution.
 *
 * Given a graph of some task class, produce structural variants that stress
 * the fitness signal. Every variant is a *pure* transformation of the original
 * graph — no oracle, no LLM, no human. The variants share the task class so
 * `Evolution.convergence` can measure how much of the strategy survives
 * perturbation, and the bad variants feed `Evolution.distill` as the "bad"
 * side of a good/bad pair.
 *
 * Perturbations:
 *
 *   - `reorder` — same states, reversed tool order on the main path. The agent
 *     did the same work in a different order; detour rises because the
 *     shortest causal path is now shorter than the walk taken.
 *   - `detour`  — insert a redundant node mid-path whose state_snapshot is
 *     subsumed by its successor. Simulates wandering; redundancy rises.
 *   - `failure` — mark a mid-path node failed and attach a `retry` edge back
 *     to its parent. Simulates a brittle run; recovery depends on whether the
 *     runner actually re-attempts.
 */
export function perturb(input: PerturbInput): readonly GraphInput[] {
  return [input.graph, reorder(input), detour(input), failure(input)]
}

/** A fresh trajectory id so each variant is a distinct comparable graph. */
const freshTrajectory = (graph: GraphInput): TrajectorySchema.Trajectory => ({
  ...graph.trajectory,
  id: TrajectorySchema.newTrajectoryID(),
  version: graph.trajectory.version + 1,
})

const clone = (graph: GraphInput, trajectory: TrajectorySchema.Trajectory): GraphInput => ({
  trajectory,
  nodes: graph.nodes.map((node) => ({ ...node, trajectory_id: trajectory.id })),
  edges: graph.edges.map((edge) => ({ ...edge, trajectory_id: trajectory.id })),
})

/**
 * The main path: the chain of single-child `control` edges leaving the root.
 * Branches fork off it and are not part of the prefix the adversary perturbs.
 */
const mainPath = (graph: GraphInput): TrajectorySchema.Node[] => {
  const byID = new Map(graph.nodes.map((node) => [node.id, node]))
  const children = new Map<string, string[]>()
  for (const edge of graph.edges) {
    if (edge.kind !== "control") continue
    children.set(edge.from_node_id, [...(children.get(edge.from_node_id) ?? []), edge.to_node_id])
  }
  const path: TrajectorySchema.Node[] = []
  let current = byID.get(graph.trajectory.root_node_id)
  while (current) {
    path.push(current)
    const nextIDs = children.get(current.id) ?? []
    if (nextIDs.length !== 1) break
    const next = byID.get(nextIDs[0]!)
    if (!next) break
    current = next
  }
  return path
}

/** Reverse the tool order on the main path (root stays first, tail follows). */
const reorder = (input: PerturbInput): GraphInput => {
  const { graph } = input
  const path = mainPath(graph)
  if (path.length < 3) return clone(graph, freshTrajectory(graph))
  const order = [path[0]!, ...path.slice(1).reverse()]

  const nodes = graph.nodes.map((node) => {
    const position = order.findIndex((n) => n.id === node.id)
    if (position < 0) return node
    return { ...node, step_index: position }
  })
  const edges = [
    ...graph.edges.filter((edge) => edge.kind !== "control"),
    ...order.slice(0, -1).map((node, index) => ({
      id: TrajectorySchema.newEdgeID(),
      trajectory_id: graph.trajectory.id,
      from_node_id: node.id,
      to_node_id: order[index + 1]!.id,
      kind: "control" as const,
      time_created: Date.now(),
    })),
  ]
  const trajectory = freshTrajectory(graph)
  return {
    trajectory,
    nodes: nodes.map((node) => ({ ...node, trajectory_id: trajectory.id })),
    edges: edges.map((edge) => ({ ...edge, trajectory_id: trajectory.id })),
  }
}

/** Insert a redundant node mid-path, subsumed by its successor. */
const detour = (input: PerturbInput): GraphInput => {
  const { graph } = input
  const path = mainPath(graph)
  if (path.length < 2) return clone(graph, freshTrajectory(graph))
  const tail = path[path.length - 1]!
  const redundant: TrajectorySchema.Node = {
    id: TrajectorySchema.newNodeID(),
    trajectory_id: graph.trajectory.id,
    branch_id: "detour",
    step_index: tail.step_index + 1,
    input_payload: { detour: true, from: tail.id },
    output_payload: { detour: true, result: "noise" },
    tool_name: "bash",
    parent_ids: [tail.id],
    fork_ids: [],
    state_snapshot: { ...(tail.state_snapshot as object), noise: "dead weight" },
    time_created: Date.now(),
  }
  const edges = [
    ...graph.edges.filter((edge) => edge.to_node_id !== tail.id || edge.kind !== "control"),
    {
      id: TrajectorySchema.newEdgeID(),
      trajectory_id: graph.trajectory.id,
      from_node_id: tail.id,
      to_node_id: redundant.id,
      kind: "control" as const,
      time_created: Date.now(),
    },
  ]
  const trajectory = freshTrajectory(graph)
  return {
    trajectory,
    nodes: [...graph.nodes, { ...redundant, trajectory_id: trajectory.id }].map((node) =>
      node.id === redundant.id ? node : { ...node, trajectory_id: trajectory.id },
    ),
    edges: edges.map((edge) => ({ ...edge, trajectory_id: trajectory.id })),
  }
}

/**
 * Mark a mid-path node failed and abort the run there. The bad graph keeps
 * the prefix up to the failure and drops the good suffix entirely — that is
 * the whole point of the variant: `distill` aligns by state hash, so a bad
 * graph that merely *marks* a node failed still shares every state with the
 * good graph and yields no divergence. Aborting is what makes the good suffix
 * distillable: the bad graph took the prefix and never reached the tail.
 */
const failure = (input: PerturbInput): GraphInput => {
  const { graph } = input
  const path = mainPath(graph)
  if (path.length < 3) return clone(graph, freshTrajectory(graph))
  const target = path[Math.floor(path.length / 2)]!
  const suffix = path.slice(path.indexOf(target))
  const drop = new Set(suffix.map((node) => node.id))
  const failed: TrajectorySchema.Node = {
    ...target,
    id: TrajectorySchema.newNodeID(),
    branch_id: "failure",
    step_index: target.step_index + 1,
    state_snapshot: { ...(target.state_snapshot as object), error: "failed", status: "failed" },
    metadata: { ...(target.metadata as object | undefined), annotations: { status: "failed" } },
  }
  const parentID = target.parent_ids[0]
  const edges = [
    ...graph.edges.filter((edge) => !drop.has(edge.from_node_id) && !drop.has(edge.to_node_id)),
    {
      id: TrajectorySchema.newEdgeID(),
      trajectory_id: graph.trajectory.id,
      from_node_id: failed.id,
      to_node_id: parentID ?? target.id,
      kind: "retry" as const,
      time_created: Date.now(),
    },
  ]
  const trajectory = freshTrajectory(graph)
  return {
    trajectory,
    nodes: [...graph.nodes.filter((node) => !drop.has(node.id)), { ...failed, trajectory_id: trajectory.id }].map(
      (node) => (node.id === failed.id ? node : { ...node, trajectory_id: trajectory.id }),
    ),
    edges: edges.map((edge) => ({ ...edge, trajectory_id: trajectory.id })),
  }
}