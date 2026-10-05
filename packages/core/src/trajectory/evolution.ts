export * as Evolution from "./evolution"

import { Context, Effect, Layer, Schema } from "effect"
import { makeGlobalNode } from "../effect/app-node"
import { Hash } from "../util/hash"
import { TrajectorySchema } from "./schema"
import { TrajectoryStore } from "./store"

/** Input to the fitness function: a trajectory and its edges. */
export interface GraphInput {
  readonly trajectory: TrajectorySchema.Trajectory
  readonly nodes: readonly TrajectorySchema.Node[]
  readonly edges: readonly TrajectorySchema.Edge[]
}

/**
 * Input to `distill`: a bad graph and a good graph of the **same task
 * class**. The good graph is the one that succeeded efficiently; the bad one
 * is the one that wandered or failed. Alignment is by state hash, so the two
 * graphs do not need to share node IDs — they only need to have passed
 * through the same states.
 */
export interface DistillInput {
  readonly task_class: string
  readonly good: GraphInput
  readonly bad: GraphInput
}

/** Output of `distill`: policies to persist + shortcut edges to write back. */
export interface DistillResult {
  readonly policies: readonly TrajectorySchema.Policy[]
  readonly shortcuts: readonly {
    readonly from_node_id: string
    readonly to_node_id: string
    readonly kind: "shortcut"
  }[]
}

/**
 * Fitness signal for a single graph. All four metrics are pure graph
 * topology — no oracle, no LLM judge, no human. That is the whole point:
 * the agent scores itself by how well its execution graph is structured.
 */
export interface Fitness {
  /** Fraction of nodes whose state_snapshot is subsumed by a successor. */
  readonly redundancy: number
  /** Actual path length / shortest causal path length (>= 1). */
  readonly detour: number
  /** Failed nodes that have a retry edge / total failed nodes. */
  readonly recovery: number
  /**
   * 0..1 — how much of this graph's strategy is already shared with the other
   * graphs of its task class. Undefined when the caller supplied no peers,
   * because convergence is a property of a *set* and is meaningless for one
   * graph alone.
   *
   * High convergence combined with low redundancy/detour is the actual signal
   * that self-evolution is working: the agent is converging on a shape and that
   * shape is efficient. High redundancy at high convergence means it has
   * fossilised a bad habit, which is what policy demotion exists to catch.
   */
  readonly convergence?: number
}

/**
 * A graph plus the peers it should be scored against. Absent peers, convergence
 * is simply not computed rather than defaulted to a flattering number.
 */
export interface FitnessInput extends GraphInput {
  readonly peers?: readonly GraphInput[]
}

export interface Interface {
  /**
   * Produce the `extra_edges` to attach to a node that re-attempts a failed
   * node. The edge is written at append time by the stepper; nothing is
   * persisted until the retry node actually lands.
   */
  readonly markRetry: (failedNodeID: string) => {
    readonly from_node_id: string
    readonly kind: TrajectorySchema.EdgeKind
  }
  /**
   * Produce the `extra_edges` to attach to a node that resumes execution
   * after a validated prefix. The prefix is skipped on the next run of the
   * same task class (see the runner's policy lookup).
   */
  readonly markShortcut: (prefixTailNodeID: string) => {
    readonly from_node_id: string
    readonly kind: TrajectorySchema.EdgeKind
  }
  /** All edges in a trajectory, in write order. */
  readonly edges: (trajectoryID: string) => Effect.Effect<TrajectorySchema.Edge[]>
  /**
   * Compute all four fitness attributes (pure; no I/O). `convergence` is only
   * present when the input carries peers of the same task class to compare
   * against.
   */
  readonly fitness: (input: FitnessInput) => Fitness
  /**
   * Scalar good/bad ordering over peer graphs of one task class. Lower is worse.
   *
   * Used by the evolution cycle to pick which graph is "good" and which is
   * "bad". Redundancy and detour are penalties, recovery and convergence are
   * credits, and failure itself dominates: a graph that never reached a
   * terminal node cannot be the exemplar no matter how well-shaped it is.
   */
  readonly score: (input: FitnessInput & { readonly graph: GraphInput }) => number
}

export class Service extends Context.Service<Service, Interface>()("@codewright/v2/trajectory/Evolution") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const store = yield* TrajectoryStore.Service

    const markRetry = (failedNodeID: string) => ({
      from_node_id: failedNodeID,
      kind: "retry" as const,
    })
    const markShortcut = (prefixTailNodeID: string) => ({
      from_node_id: prefixTailNodeID,
      kind: "shortcut" as const,
    })

    const edges = Effect.fn("Evolution.edges")(function* (trajectoryID: string) {
      return yield* store.edges(trajectoryID)
    })

    /**
     * Pure-structure fitness. No oracle required:
     *
     * - redundancy: a node whose state_snapshot is subsumed by a successor's
     *   is dead weight — it could have been skipped. Lower is better.
     * - detour: actual path length over shortest causal path length. A value
     *   of 1 is a straight line; higher means the agent wandered.
     * - recovery: fraction of failed nodes that have a retry edge. An agent
     *   that never retries has recovery 0 and is brittle.
     * - convergence: across graphs of the same task class, how much of the
     *   successful strategy is shared. Higher means the agent is stabilising.
     */
    const fitness = (input: FitnessInput): Fitness => {
      const { nodes, edges } = input

      // --- redundancy: state_snapshot subsumption by a successor -------------
      let redundant = 0
      for (const node of nodes) {
        if (node.state_snapshot === undefined) continue
        const snap = node.state_snapshot
        for (const child of nodes) {
          if (child.id === node.id) continue
          const childSnap = child.state_snapshot
          if (childSnap === undefined) continue
          if (subsumes(childSnap, snap)) {
            redundant++
            break
          }
        }
      }
      const redundancy = nodes.length === 0 ? 0 : redundant / nodes.length

      // --- detour: path length over shortest causal path ---------------------
      // Build adjacency from causal + control edges (the "real" execution
      // path), then compare the longest root-to-leaf walk against the
      // shortest path between the same endpoints.
      const forward = new Map<string, string[]>()
      for (const edge of edges) {
        if (edge.kind === "merge") continue
        forward.set(edge.from_node_id, [...(forward.get(edge.from_node_id) ?? []), edge.to_node_id])
      }
      const root = input.trajectory.root_node_id
      const longest = longestWalk(root, forward)
      const shortest = shortestPath(root, longest?.to ?? root, forward)
      const detour =
        shortest && longest && shortest > 0 ? longest.length / shortest : 1

      // --- recovery: failed nodes with a retry edge --------------------------
      const failed = nodes.filter((node) => isFailed(node))
      const retried = new Set<string>()
      for (const edge of edges) {
        if (edge.kind === "retry") retried.add(edge.from_node_id)
      }
      const recovery = failed.length === 0 ? 0 : [...retried].filter((id) => failed.some((node) => node.id === id)).length / failed.length

      const convergence =
        input.peers === undefined || input.peers.length === 0 ? undefined : measureConvergence(input, input.peers)

      return { redundancy, detour, recovery, convergence }
    }

    const score = (input: FitnessInput & { readonly graph: GraphInput }): number => {
      const f = fitness(input)
      const failed = input.graph.nodes.filter((node) => isFailed(node)).length
      const converged = f.convergence ?? 0
      // A graph that never reached a terminal node is disqualified outright —
      // topology alone must not promote a half-finished run into an exemplar.
      if (failed > 0 && f.recovery === 0) return Number.NEGATIVE_INFINITY
      return -2 * f.redundancy - 1.5 * (f.detour - 1) + 0.5 * f.recovery + 1.5 * converged - 3 * failed
    }

    return Service.of({ markRetry, markShortcut, edges, fitness, score })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [TrajectoryStore.node] })

/**
 * Convergence: how much of this graph's main-path strategy is already shared
 * with peers of the same task class. Undefined without peers.
 *
 * Measured as mean weighted Jaccard over the peers' main paths — tools are
 * weighted by occurrence count, so "read 5x, edit 2x" against "read 1x, edit 1x"
 * scores below two graphs whose tool multisets match. Two graphs solving the
 * same intent with the same tools in the same proportions score 1 regardless of
 * node IDs, which is the point: what identifies a strategy is its states and
 * tool usage, not its row keys.
 */
function measureConvergence(graph: GraphInput, peers: readonly GraphInput[]): number {
  const self = toolMultiset(mainPathFromRoot(graph))
  if (self.size === 0) return 0
  let total = 0
  let compared = 0
  for (const peer of peers) {
    if (peer === graph) continue
    const other = toolMultiset(mainPathFromRoot(peer))
    if (other.size === 0) continue
    let intersection = 0
    let union = 0
    for (const tool of new Set([...self.keys(), ...other.keys()])) {
      const a = self.get(tool) ?? 0
      const b = other.get(tool) ?? 0
      intersection += Math.min(a, b)
      union += Math.max(a, b)
    }
    if (union === 0) continue
    total += intersection / union
    compared++
  }
  return compared === 0 ? 0 : total / compared
}

function toolMultiset(path: readonly TrajectorySchema.Node[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const node of path) {
    if (node.tool_name === undefined) continue
    counts.set(node.tool_name, (counts.get(node.tool_name) ?? 0) + 1)
  }
  return counts
}

/**
 * Align a bad graph against a good graph of the same task class and extract
 * the difference: the good suffix the bad graph never took. The result is a
 * policy to persist plus the shortcut edge to write back into the good graph.
 *
 * Alignment is by state hash, so the two graphs need not share node IDs — they
 * only need to have passed through the same states. The divergence point is
 * the last good node on the main path whose state also appears in the bad
 * graph; everything after it is the validated suffix.
 */
export function distill(input: DistillInput): DistillResult {
  const goodByState = new Map<string, TrajectorySchema.Node[]>()
  const badByState = new Map<string, TrajectorySchema.Node[]>()
  for (const node of input.good.nodes) {
    const key = stateHash(node)
    goodByState.set(key, [...(goodByState.get(key) ?? []), node])
  }
  for (const node of input.bad.nodes) {
    const key = stateHash(node)
    badByState.set(key, [...(badByState.get(key) ?? []), node])
  }

  // Walk the good graph's main path from the root, following control edges.
  // The main path is the chain of single-child control edges; branches fork
  // off it and are not part of the prefix we are distilling.
  const mainPath = mainPathFromRoot(input.good)
  let divergence: TrajectorySchema.Node | undefined
  let suffix: readonly TrajectorySchema.Node[] = []
  for (let index = 0; index < mainPath.length; index++) {
    const node = mainPath[index]!
    if (!badByState.has(stateHash(node))) break
    divergence = node
    suffix = mainPath.slice(index + 1)
  }

  if (!divergence || suffix.length === 0) return { policies: [], shortcuts: [] }

  const tool_sequence = suffix.map((node) => node.tool_name).filter((name): name is string => name !== undefined)
  if (tool_sequence.length === 0) return { policies: [], shortcuts: [] }

  const policy: TrajectorySchema.Policy = {
    id: TrajectorySchema.newPolicyID(),
    state_hash: stateHash(divergence),
    task_class: input.task_class,
    tool_sequence,
    validated: true,
    generation: input.good.trajectory.version,
    trajectory_id: input.good.trajectory.id,
    time_created: Date.now(),
  }

  return {
    policies: [policy],
    shortcuts: [{ from_node_id: divergence.id, to_node_id: suffix[0]!.id, kind: "shortcut" }],
  }
}

/** sha256 of the canonical state a node was entered from. */
function stateHash(node: TrajectorySchema.Node): string {
  return Hash.sha256(TrajectoryStore.canonicalJson(node.state_snapshot ?? node.output_payload))
}

/** The chain of single-child control edges leaving the root (the main path). */
function mainPathFromRoot(graph: GraphInput): TrajectorySchema.Node[] {
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

/** `child` subsumes `parent` when every key/path in parent is present in child. */
function subsumes(child: unknown, parent: unknown): boolean {
  if (parent === child) return true
  if (parent === null || typeof parent !== "object") return false
  if (child === null || typeof child !== "object") return false
  if (Array.isArray(parent)) {
    if (!Array.isArray(child)) return false
    return parent.every((item, index) => subsumes(child[index], item))
  }
  const p = parent as Record<string, unknown>
  const c = child as Record<string, unknown>
  for (const key of Object.keys(p)) {
    if (!(key in c)) return false
    if (!subsumes(c[key], p[key])) return false
  }
  return true
}

/** A node is "failed" when its metadata records a terminal failure. */
function isFailed(node: TrajectorySchema.Node): boolean {
  const annotations = (node.metadata as Record<string, unknown> | undefined)?.annotations as
    | Record<string, unknown>
    | undefined
  return annotations?.status === "failed" || annotations?.outcome === "failed"
}

function longestWalk(root: string, forward: Map<string, string[]>): { to: string; length: number } | undefined {
  const visited = new Set<string>()
  const best: { to: string; length: number } = { to: root, length: 0 }
  const stack: { node: string; length: number }[] = [{ node: root, length: 0 }]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    if (visited.has(current.node)) continue
    visited.add(current.node)
    if (current.length > best.length) {
      best.to = current.node
      best.length = current.length
    }
    for (const next of forward.get(current.node) ?? []) {
      if (!visited.has(next)) stack.push({ node: next, length: current.length + 1 })
    }
  }
  return best
}

function shortestPath(from: string, to: string, forward: Map<string, string[]>): number | undefined {
  if (from === to) return 0
  const visited = new Set<string>([from])
  const queue: { node: string; length: number }[] = [{ node: from, length: 0 }]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue
    for (const next of forward.get(current.node) ?? []) {
      if (next === to) return current.length + 1
      if (!visited.has(next)) {
        visited.add(next)
        queue.push({ node: next, length: current.length + 1 })
      }
    }
  }
  return undefined
}