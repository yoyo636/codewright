import { describe, expect, test } from "bun:test"
import { Effect, Stream } from "effect"
import { AppNodeBuilder } from "@codewright-ai/core/effect/app-node-builder"
import { LayerNode } from "@codewright-ai/core/effect/layer-node"
import { Database } from "@codewright-ai/core/database/database"
import { Evolution } from "@codewright-ai/core/trajectory/evolution"
import { PolicyStore } from "@codewright-ai/core/trajectory/policy-store"
import { Adversary } from "@codewright-ai/core/trajectory/adversary"
import { SelfEvolution } from "@codewright-ai/core/trajectory/self-evolution"
import { EvolutionCycle } from "@codewright-ai/core/trajectory/cycle"
import { TrajectorySchema } from "@codewright-ai/core/trajectory/schema"
import { Hash } from "@codewright-ai/core/util/hash"
import { TrajectoryStore } from "@codewright-ai/core/trajectory"
import { testEffect } from "./lib/effect"

const withStore = AppNodeBuilder.build(
  LayerNode.group([TrajectoryStore.node, PolicyStore.node, Evolution.node, SelfEvolution.node, EvolutionCycle.node]),
  [[Database.node, Database.layerFromPath(":memory:")]],
)

const it = testEffect(withStore)

const collect = <A, E>(stream: Stream.Stream<A, E>) =>
  Stream.runCollect(stream).pipe(Effect.map((chunk) => [...chunk]))

const appendChain = (
  store: TrajectoryStore.Interface,
  trajectoryID: string,
  branchID: string,
  steps: number,
  rootID: string,
) =>
  Effect.gen(function* () {
    const nodes = []
    let parentID = rootID
    for (let step = 0; step < steps; step++) {
      const node = yield* store.append({
        trajectory_id: trajectoryID,
        branch_id: branchID,
        parent_ids: parentID ? [parentID] : [],
        input_payload: { step, request: "call-" + step },
        output_payload: { step, result: "ok-" + step },
        tool_name: "bash",
        state_snapshot: { env: { cwd: "/tmp", step } },
      })
      nodes.push(node)
      parentID = node.id
    }
    return nodes
  })

const graphOf = (store: TrajectoryStore.Interface, evolution: Evolution.Interface, trajectoryID: string) =>
  Effect.gen(function* () {
    return {
      trajectory: (yield* store.getTrajectory(trajectoryID).pipe(Effect.orDie)) as TrajectorySchema.Trajectory,
      nodes: yield* collect(store.replay(trajectoryID)),
      edges: yield* evolution.edges(trajectoryID),
    }
  })

describe("Evolution", () => {
  it.live("marks retry and shortcut edges at write time", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const evolution = yield* Evolution.Service
      const trajectory = yield* store.create()
      const [, second] = yield* appendChain(store, trajectory.id, "root", 2, trajectory.root_node_id)

      const failed = yield* store.append({
        trajectory_id: trajectory.id,
        branch_id: "root",
        parent_ids: [second.id],
        input_payload: { step: 2, request: "call-2" },
        output_payload: { step: 2, result: "error" },
        tool_name: "bash",
        state_snapshot: { env: { cwd: "/tmp", step: 2 } },
        metadata: { annotations: { status: "failed" } },
      })

      // The retry edge is produced by the evolution layer and attached to the
      // retrying node's append; nothing is persisted until that node lands.
      const retryEdge = evolution.markRetry(failed.id)
      expect(retryEdge.kind).toBe("retry")
      expect(retryEdge.from_node_id).toBe(failed.id)

      const retry = yield* store.append({
        trajectory_id: trajectory.id,
        branch_id: "root",
        parent_ids: [second.id],
        input_payload: { step: 2, request: "call-2" },
        output_payload: { step: 2, result: "ok-2" },
        tool_name: "bash",
        state_snapshot: { env: { cwd: "/tmp", step: 2 } },
        step_index: 4,
        extra_edges: [evolution.markRetry(failed.id)],
      })

      const shortcutEdge = evolution.markShortcut(second.id)
      expect(shortcutEdge.kind).toBe("shortcut")
      const resume = yield* store.append({
        trajectory_id: trajectory.id,
        branch_id: "root",
        parent_ids: [retry.id],
        input_payload: { step: 3, request: "call-3" },
        output_payload: { step: 3, result: "ok-3" },
        tool_name: "bash",
        extra_edges: [evolution.markShortcut(second.id)],
      })

      const edges = yield* evolution.edges(trajectory.id)
      const byTo = new Map(edges.map((edge) => [edge.to_node_id, edge]))
      expect(byTo.get(retry.id)?.kind).toBe("retry")
      expect(byTo.get(resume.id)?.kind).toBe("shortcut")
    }))

  it.live("fitness is pure structure: redundancy, detour, recovery", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const evolution = yield* Evolution.Service
      const trajectory = yield* store.create()
      yield* appendChain(store, trajectory.id, "root", 3, trajectory.root_node_id)

      // A straight 3-step chain: no redundancy, detour 1, no failures.
      const straight = evolution.fitness(yield* graphOf(store, evolution, trajectory.id))
      expect(straight.redundancy).toBe(0)
      expect(straight.detour).toBe(1)
      expect(straight.recovery).toBe(0)

      // A node whose state_snapshot is subsumed by a successor is redundant.
      const subsumed = yield* store.append({
        trajectory_id: trajectory.id,
        branch_id: "side",
        parent_ids: [trajectory.root_node_id],
        input_payload: { step: 99 },
        output_payload: { step: 99, result: "ok-99" },
        tool_name: "bash",
        state_snapshot: { env: { cwd: "/tmp", step: 2 }, extra: "dead" },
      })
      const withRedundancy = evolution.fitness(yield* graphOf(store, evolution, trajectory.id))
      // subsumed's snapshot contains the last chain node's snapshot plus an
      // extra key, so that chain node is redundant.
      expect(withRedundancy.redundancy).toBeGreaterThan(0)

      // A failed node with a retry edge raises recovery above 0.
      const failed = yield* store.append({
        trajectory_id: trajectory.id,
        branch_id: "side",
        parent_ids: [subsumed.id],
        input_payload: { step: 4, request: "call-4" },
        output_payload: { step: 4, result: "error" },
        tool_name: "bash",
        state_snapshot: { env: { cwd: "/tmp", step: 4 } },
        metadata: { annotations: { status: "failed" } },
      })
      yield* store.append({
        trajectory_id: trajectory.id,
        branch_id: "side",
        parent_ids: [subsumed.id],
        input_payload: { step: 4, request: "call-4" },
        output_payload: { step: 4, result: "ok-4" },
        tool_name: "bash",
        state_snapshot: { env: { cwd: "/tmp", step: 4 } },
        step_index: subsumed.step_index + 2,
        extra_edges: [evolution.markRetry(failed.id)],
      })
      const withRecovery = evolution.fitness(yield* graphOf(store, evolution, trajectory.id))
      expect(withRecovery.recovery).toBeGreaterThan(0)
      expect(withRecovery.recovery).toBeLessThanOrEqual(1)
    }))

  it.live("distills the good suffix a bad graph never took", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const evolution = yield* Evolution.Service

      // Good graph: root -> bash -> webfetch -> edit
      const good = yield* store.create({ title: "good" })
      const gRoot = yield* store.getNode(good.root_node_id)
      const g1 = yield* store.append({
        trajectory_id: good.id,
        branch_id: "root",
        parent_ids: [gRoot!.id],
        input_payload: { step: 1 },
        output_payload: { step: 1 },
        tool_name: "bash",
        state_snapshot: { s: 1 },
      })
      const g2 = yield* store.append({
        trajectory_id: good.id,
        branch_id: "root",
        parent_ids: [g1.id],
        input_payload: { step: 2 },
        output_payload: { step: 2 },
        tool_name: "webfetch",
        state_snapshot: { s: 2 },
      })
      const g3 = yield* store.append({
        trajectory_id: good.id,
        branch_id: "root",
        parent_ids: [g2.id],
        input_payload: { step: 3 },
        output_payload: { step: 3 },
        tool_name: "edit",
        state_snapshot: { s: 3 },
      })

      // Bad graph: shares root + g1 states, then diverges into bash loops.
      const bad = yield* store.create({ title: "bad" })
      const bRoot = yield* store.getNode(bad.root_node_id)
      const b1 = yield* store.append({
        trajectory_id: bad.id,
        branch_id: "root",
        parent_ids: [bRoot!.id],
        input_payload: { step: 1 },
        output_payload: { step: 1 },
        tool_name: "bash",
        state_snapshot: { s: 1 },
      })
      yield* store.append({
        trajectory_id: bad.id,
        branch_id: "root",
        parent_ids: [b1.id],
        input_payload: { step: 2 },
        output_payload: { step: 2 },
        tool_name: "bash",
        state_snapshot: { s: 4 },
        step_index: 2,
      })
      yield* store.append({
        trajectory_id: bad.id,
        branch_id: "root",
        parent_ids: [b1.id],
        input_payload: { step: 3 },
        output_payload: { step: 3 },
        tool_name: "bash",
        state_snapshot: { s: 5 },
        step_index: 3,
      })

      const result = Evolution.distill({
        task_class: "auth-refactor",
        good: yield* graphOf(store, evolution, good.id),
        bad: yield* graphOf(store, evolution, bad.id),
      })

      expect(result.policies).toHaveLength(1)
      expect(result.policies[0]?.task_class).toBe("auth-refactor")
      expect(result.policies[0]?.tool_sequence).toEqual(["webfetch", "edit"])
      expect(result.policies[0]?.validated).toBe(true)
      expect(result.policies[0]?.trajectory_id).toBe(good.id)
      expect(result.shortcuts).toEqual([{ from_node_id: g1.id, to_node_id: g2.id, kind: "shortcut" }])

      // Persisting the policy round-trips through the store.
      const policyStore = yield* PolicyStore.Service
      const put = yield* policyStore.put({
        state_hash: result.policies[0]!.state_hash,
        task_class: result.policies[0]!.task_class,
        tool_sequence: result.policies[0]!.tool_sequence,
        validated: true,
        generation: result.policies[0]!.generation,
        trajectory_id: result.policies[0]!.trajectory_id,
      })
      const lookedUp = yield* policyStore.lookup(put.state_hash, "auth-refactor")
      expect(lookedUp?.tool_sequence).toEqual(["webfetch", "edit"])
      expect(lookedUp?.validated).toBe(true)

      // Re-distilling the same pair refreshes the policy instead of duplicating.
      const again = yield* policyStore.put({
        state_hash: put.state_hash,
        task_class: "auth-refactor",
        tool_sequence: ["edit"],
        validated: true,
      })
      expect(again.id).not.toBe(put.id)
      const refreshed = yield* policyStore.lookup(put.state_hash, "auth-refactor")
      expect(refreshed?.tool_sequence).toEqual(["edit"])
    }))
})

const buildToolChain = (
  store: TrajectoryStore.Interface,
  trajectoryID: string,
  tools: readonly string[],
) =>
  Effect.gen(function* () {
    const trajectory = (yield* store.getTrajectory(trajectoryID).pipe(Effect.orDie)) as TrajectorySchema.Trajectory
    let parentID = trajectory.root_node_id
    for (let index = 0; index < tools.length; index++) {
      const node = yield* store.append({
        trajectory_id: trajectoryID,
        branch_id: "root",
        parent_ids: parentID ? [parentID] : [],
        input_payload: { step: index + 1 },
        output_payload: { step: index + 1, tool: tools[index] },
        tool_name: tools[index],
        state_snapshot: { s: index + 1 },
      })
      parentID = node.id
    }
    return yield* graphOf(store, yield* Evolution.Service, trajectoryID)
  })

/** Tool names on the main path, root-to-leaf, following single-child control edges. */
const mainPathTools = (graph: Evolution.GraphInput): readonly string[] => {
  const byID = new Map(graph.nodes.map((node) => [node.id, node]))
  const children = new Map<string, string[]>()
  for (const edge of graph.edges) {
    if (edge.kind !== "control") continue
    children.set(edge.from_node_id, [...(children.get(edge.from_node_id) ?? []), edge.to_node_id])
  }
  const path: string[] = []
  let current = byID.get(graph.trajectory.root_node_id)
  while (current) {
    if (current.tool_name) path.push(current.tool_name)
    const nextIDs = children.get(current.id) ?? []
    if (nextIDs.length !== 1) break
    const next = byID.get(nextIDs[0]!)
    if (!next) break
    current = next
  }
  return path
}

describe("Adversary", () => {
  it.live("returns the original graph plus three structural variants", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const evolution = yield* Evolution.Service
      const trajectory = yield* store.create({ title: "adversary" })
      const good = yield* buildToolChain(store, trajectory.id, ["bash", "webfetch", "edit"])

      const variants = Adversary.perturb({ graph: good, task_class: "auth-refactor" })

      expect(variants).toHaveLength(4)
      // The original is preserved unchanged.
      expect(variants[0]).toBe(good)
      // Every variant is a distinct trajectory.
      const ids = new Set(variants.map((graph) => graph.trajectory.id))
      expect(ids.size).toBe(4)
      // Reorder and detour keep the graph size; the failure variant aborts mid
      // run and so is smaller — that is what makes its good suffix distillable.
      expect(variants[1]!.nodes.length).toBe(good.nodes.length)
      expect(variants[2]!.nodes.length).toBe(good.nodes.length + 1)
      expect(variants[3]!.nodes.length).toBeLessThan(good.nodes.length)
    }))

  it.live("reverses the main-path tool order", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const evolution = yield* Evolution.Service
      const trajectory = yield* store.create({ title: "reorder" })
      const good = yield* buildToolChain(store, trajectory.id, ["bash", "webfetch", "edit"])
      expect(mainPathTools(good)).toEqual(["bash", "webfetch", "edit"])

      const variants = Adversary.perturb({ graph: good, task_class: "reorder" })
      const reordered = variants[1]!
      expect(mainPathTools(reordered)).toEqual(["edit", "webfetch", "bash"])
    }))

  it.live("detour inserts a redundant node and raises redundancy", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const evolution = yield* Evolution.Service
      const trajectory = yield* store.create({ title: "detour" })
      const good = yield* buildToolChain(store, trajectory.id, ["bash", "webfetch", "edit"])
      expect(evolution.fitness(good).redundancy).toBe(0)

      const variants = Adversary.perturb({ graph: good, task_class: "detour" })
      const detoured = variants[2]!
      expect(detoured.nodes.length).toBe(good.nodes.length + 1)
      expect(evolution.fitness(detoured).redundancy).toBeGreaterThan(0)
    }))

  it.live("failure marks a node failed and raises recovery", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const evolution = yield* Evolution.Service
      const trajectory = yield* store.create({ title: "failure" })
      const good = yield* buildToolChain(store, trajectory.id, ["bash", "webfetch", "edit"])
      expect(evolution.fitness(good).recovery).toBe(0)

      const variants = Adversary.perturb({ graph: good, task_class: "failure" })
      const failed = variants[3]!
      expect(failed.nodes.some((node) => isFailedNode(node))).toBe(true)
      expect(failed.edges.some((edge) => edge.kind === "retry")).toBe(true)
      expect(evolution.fitness(failed).recovery).toBeGreaterThan(0)
    }))
})

/** A node is "failed" when its metadata records a terminal failure. */
function isFailedNode(node: TrajectorySchema.Node): boolean {
  const annotations = (node.metadata as Record<string, unknown> | undefined)?.annotations as
    | Record<string, unknown>
    | undefined
  return annotations?.status === "failed" || annotations?.outcome === "failed"
}

describe("SelfEvolution", () => {
  it.live("fitness carries convergence against peers and score orders graphs", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const evolution = yield* Evolution.Service

      // Two graphs solving the same intent with the same tool multiset.
      const a = yield* store.create({ title: "a", taskClass: "refactor" })
      yield* buildToolChain(store, a.id, ["bash", "webfetch", "edit"])
      const b = yield* store.create({ title: "b", taskClass: "refactor" })
      yield* buildToolChain(store, b.id, ["bash", "webfetch", "edit"])

      const aGraph = yield* graphOf(store, evolution, a.id)
      const bGraph = yield* graphOf(store, evolution, b.id)

      // Convergence is undefined without peers and 1 against an identical peer.
      expect(evolution.fitness(aGraph).convergence).toBeUndefined()
      expect(evolution.fitness({ ...aGraph, peers: [bGraph] }).convergence).toBe(1)

      // A graph that shares no tools with its peer scores 0 convergence.
      const c = yield* store.create({ title: "c", taskClass: "refactor" })
      yield* buildToolChain(store, c.id, ["read", "read", "read"])
      const cGraph = yield* graphOf(store, evolution, c.id)
      expect(evolution.fitness({ ...aGraph, peers: [cGraph] }).convergence).toBe(0)

      // score: identical peers tie; a converged graph outranks a disjoint one.
      expect(evolution.score({ ...aGraph, peers: [bGraph], graph: aGraph })).toBe(
        evolution.score({ ...bGraph, peers: [aGraph], graph: bGraph }),
      )
      expect(evolution.score({ ...aGraph, peers: [bGraph], graph: aGraph })).toBeGreaterThan(
        evolution.score({ ...aGraph, peers: [cGraph], graph: aGraph }),
      )

      // A graph with a failed node and no retry edge is disqualified outright.
      const failed = yield* store.append({
        trajectory_id: a.id,
        branch_id: "side",
        parent_ids: [a.root_node_id],
        input_payload: { step: 9 },
        output_payload: { step: 9, result: "error" },
        tool_name: "bash",
        state_snapshot: { s: 9 },
        metadata: { annotations: { status: "failed" } },
      })
      const failedGraph = yield* graphOf(store, evolution, a.id)
      expect(evolution.score({ ...failedGraph, peers: [bGraph], graph: failedGraph })).toBe(
        Number.NEGATIVE_INFINITY,
      )
    }))

  it.live("recordOutcome grades a policy and demote retires under-performers", () =>
    Effect.gen(function* () {
      const policyStore = yield* PolicyStore.Service

      const put = yield* policyStore.put({
        state_hash: "st-1",
        task_class: "refactor",
        tool_sequence: ["webfetch", "edit"],
        validated: true,
      })
      // A policy with no observations is not yet eligible for demotion.
      expect((yield* policyStore.demote({ taskClass: "refactor", floor: 0.5, minSamples: 5 })).length).toBe(0)

      // Two hits are not enough observations to judge (minSamples = 5).
      for (let index = 0; index < 2; index++) {
        yield* policyStore.recordOutcome(put.id, "hit")
      }
      expect((yield* policyStore.demote({ taskClass: "refactor", floor: 0.5, minSamples: 5 })).length).toBe(0)

      // Four misses put it at 2/6 = 0.333 success, below the 0.5 floor with
      // enough samples to judge: it is retired.
      for (let index = 0; index < 4; index++) {
        yield* policyStore.recordOutcome(put.id, "miss")
      }
      const demoted = yield* policyStore.demote({ taskClass: "refactor", floor: 0.5, minSamples: 5 })
      expect(demoted).toHaveLength(1)
      expect(demoted[0]?.validated).toBe(false)

      // A retired policy is no longer returned by lookup, but its row persists
      // so re-distillation does not start from a clean slate.
      expect(yield* policyStore.lookup("st-1", "refactor")).toBeUndefined()
    }))
  it.live("distills and persists policies from a good/bad pair", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const evolution = yield* Evolution.Service
      const self = yield* SelfEvolution.Service

      // Good graph: root -> bash -> webfetch -> edit
      const good = yield* store.create({ title: "good" })
      const gRoot = yield* store.getNode(good.root_node_id)
      const g1 = yield* store.append({
        trajectory_id: good.id,
        branch_id: "root",
        parent_ids: [gRoot!.id],
        input_payload: { step: 1 },
        output_payload: { step: 1 },
        tool_name: "bash",
        state_snapshot: { s: 1 },
      })
      const g2 = yield* store.append({
        trajectory_id: good.id,
        branch_id: "root",
        parent_ids: [g1.id],
        input_payload: { step: 2 },
        output_payload: { step: 2 },
        tool_name: "webfetch",
        state_snapshot: { s: 2 },
      })
      yield* store.append({
        trajectory_id: good.id,
        branch_id: "root",
        parent_ids: [g2.id],
        input_payload: { step: 3 },
        output_payload: { step: 3 },
        tool_name: "edit",
        state_snapshot: { s: 3 },
      })
      const goodGraph = yield* graphOf(store, evolution, good.id)

      // Bad graph: shares root + g1 states, then diverges into bash loops.
      const bad = yield* store.create({ title: "bad" })
      const bRoot = yield* store.getNode(bad.root_node_id)
      const b1 = yield* store.append({
        trajectory_id: bad.id,
        branch_id: "root",
        parent_ids: [bRoot!.id],
        input_payload: { step: 1 },
        output_payload: { step: 1 },
        tool_name: "bash",
        state_snapshot: { s: 1 },
      })
      yield* store.append({
        trajectory_id: bad.id,
        branch_id: "root",
        parent_ids: [b1.id],
        input_payload: { step: 2 },
        output_payload: { step: 2 },
        tool_name: "bash",
        state_snapshot: { s: 4 },
        step_index: 2,
      })
      yield* store.append({
        trajectory_id: bad.id,
        branch_id: "root",
        parent_ids: [b1.id],
        input_payload: { step: 3 },
        output_payload: { step: 3 },
        tool_name: "bash",
        state_snapshot: { s: 5 },
        step_index: 3,
      })
      const badGraph = yield* graphOf(store, evolution, bad.id)

      const result = yield* self.evolve({ task_class: "auth-refactor", good: goodGraph, bad: badGraph })

      expect(result.policies).toHaveLength(1)
      expect(result.policies[0]?.task_class).toBe("auth-refactor")
      expect(result.policies[0]?.tool_sequence).toEqual(["webfetch", "edit"])
      expect(result.policies[0]?.validated).toBe(true)
      expect(result.policies[0]?.trajectory_id).toBe(good.id)
      expect(result.shortcuts).toEqual([{ from_node_id: g1.id, to_node_id: g2.id, kind: "shortcut" }])

      // Persisted policies are queryable by the runner on the next run.
      const policyStore = yield* PolicyStore.Service
      const lookedUp = yield* policyStore.lookup(result.policies[0]!.state_hash, "auth-refactor")
      expect(lookedUp?.tool_sequence).toEqual(["webfetch", "edit"])
      expect(lookedUp?.validated).toBe(true)
    }))

  it.live("cold-starts from a single observed graph and persists a policy", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const evolutionCycle = yield* EvolutionCycle.Service
      const policyStore = yield* PolicyStore.Service

      // One observed graph of the class: nothing to compare against, so the
      // cycle manufactures its own counter-example and distills immediately.
      const trajectory = yield* store.create({ title: "solo", taskClass: "solo-class" })
      yield* buildToolChain(store, trajectory.id, ["bash", "webfetch", "edit"])

      const result = yield* evolutionCycle.run({ taskClass: "solo-class" })

      expect(result.compared).toBe(1)
      expect(result.synthetic).toBe(true)
      expect(result.policies).toHaveLength(1)
      expect(result.policies[0]?.task_class).toBe("solo-class")
      expect(result.policies[0]?.tool_sequence).toEqual(["webfetch", "edit"])
      expect(result.policies[0]?.validated).toBe(true)
      expect(result.shortcuts).toHaveLength(1)

      // The policy is now consumable by the runner on the next run.
      const lookedUp = yield* policyStore.lookup(result.policies[0]!.state_hash, "solo-class")
      expect(lookedUp?.tool_sequence).toEqual(["webfetch", "edit"])
    }))

  it.live("compares two observed graphs and distills without synthesis", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const evolutionCycle = yield* EvolutionCycle.Service
      const policyStore = yield* PolicyStore.Service

      // Good graph: straight bash -> webfetch -> edit.
      const good = yield* store.create({ title: "good", taskClass: "pair-class" })
      yield* buildToolChain(store, good.id, ["bash", "webfetch", "edit"])

      // Bad graph: shares the first state, then fails at the second and never
      // reaches the tail. It is structurally worse (a failed node, no retry),
      // so the cycle scores it below the exemplar without synthesising.
      const bad = yield* store.create({ title: "bad", taskClass: "pair-class" })
      const bRoot = yield* store.getNode(bad.root_node_id)
      const b1 = yield* store.append({
        trajectory_id: bad.id,
        branch_id: "root",
        parent_ids: [bRoot!.id],
        input_payload: { step: 1 },
        output_payload: { step: 1 },
        tool_name: "bash",
        state_snapshot: { s: 1 },
      })
      yield* store.append({
        trajectory_id: bad.id,
        branch_id: "root",
        parent_ids: [b1.id],
        input_payload: { step: 2 },
        output_payload: { step: 2, result: "error" },
        tool_name: "bash",
        state_snapshot: { s: 2, error: "failed" },
        metadata: { annotations: { status: "failed" } },
      })

      const result = yield* evolutionCycle.run({ taskClass: "pair-class" })

      expect(result.compared).toBe(2)
      expect(result.synthetic).toBe(false)
      expect(result.policies).toHaveLength(1)
      expect(result.policies[0]?.tool_sequence).toEqual(["webfetch", "edit"])
    }))
})