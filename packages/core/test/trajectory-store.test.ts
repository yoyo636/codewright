import { describe, expect, test } from "bun:test"
import { createHash } from "crypto"
import { Effect, Stream } from "effect"
import { AppNodeBuilder } from "@codewright-ai/core/effect/app-node-builder"
import { LayerNode } from "@codewright-ai/core/effect/layer-node"
import { Database } from "@codewright-ai/core/database/database"
import { TrajectorySchema } from "@codewright-ai/core/trajectory/schema"
import { TrajectoryStore } from "@codewright-ai/core/trajectory"
import { testEffect } from "./lib/effect"

const withStore = AppNodeBuilder.build(LayerNode.group([TrajectoryStore.node]), [
  [Database.node, Database.layerFromPath(":memory:")],
])

const it = testEffect(withStore)

const runStream = <A, E>(stream: Stream.Stream<A, E>) =>
  Stream.runCollect(stream).pipe(Effect.map((chunk) => [...chunk]))

const makeChain = (
  store: TrajectoryStore.Interface,
  trajectoryID: string,
  branchID: string,
  steps: number,
  rootID?: string,
) =>
  Effect.gen(function* () {
    const nodes: TrajectorySchema.Node[] = []
    let parentID = rootID ?? ""
    for (let step = 0; step < steps; step++) {
      const node = yield* store.append({
        trajectory_id: trajectoryID,
        branch_id: branchID,
        parent_ids: parentID ? [parentID] : [],
        input_payload: { step, request: "call-" + step },
        output_payload: { step, result: "ok-" + step },
        tool_call_id: "call-" + step,
        tool_name: "bash",
        reasoning_summary: `step ${step} summary`,
        state_snapshot: { env: { cwd: "/tmp", step } },
        resource_usage: { tokens: 10 * (step + 1), time_ms: 5 * (step + 1) },
      })
      nodes.push(node)
      parentID = node.id
    }
    return nodes
  })

const fingerprintOf = (payload: unknown) => createHash("sha256").update(TrajectoryStore.canonicalJson(payload)).digest("hex")

describe("TrajectoryStore", () => {
  it.live("creates a trajectory with a persisted root node", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const trajectory = yield* store.create({ title: "first-run", resource_hash: "abc123" })

      expect(trajectory.id.startsWith("traj_")).toBe(true)
      expect(trajectory.version).toBe(1)
      expect(trajectory.resource_hash).toBe("abc123")

      const loaded = yield* store.getTrajectory(trajectory.id)
      expect(loaded?.root_node_id).toBe(trajectory.root_node_id)

      const root = yield* store.getNode(trajectory.root_node_id)
      expect(root?.branch_id).toBe("root")
      expect(root?.step_index).toBe(0)
      expect(root?.parent_ids).toEqual([])
    }))

  it.live("appends nodes with auto-incrementing steps and secondary indexes", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const trajectory = yield* store.create()
      const [first, second] = yield* makeChain(store, trajectory.id, "root", 2, trajectory.root_node_id)

      // root node occupies step 0, so the chain continues at step 1
      expect(first.step_index).toBe(1)
      expect(second.step_index).toBe(2)
      expect(second.parent_ids).toEqual([first.id])
      expect(second.tool_call_id).toBe("call-1")

      // Secondary index: input content fingerprint
      const expected = fingerprintOf({ step: 1, request: "call-1" })
      const found = yield* store.byInputFingerprint(expected)
      expect(found.map((node) => node.id)).toEqual([second.id])

      // Secondary index: tool name
      const byTool = yield* store.byToolName("bash")
      expect(byTool.map((node) => node.step_index).sort((a, b) => a - b)).toEqual([1, 2])

      // Secondary index: duration range (5ms for step 1, 10ms for step 2)
      const byDuration = yield* store.byDurationRange(10, 10)
      expect(byDuration.map((node) => node.step_index)).toEqual([2])
    }))

  it.live("rejects appending to the same (trajectory, branch, step) twice", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const trajectory = yield* store.create()
      yield* store.append({
        trajectory_id: trajectory.id,
        branch_id: "root",
        parent_ids: [],
        input_payload: { n: 1 },
        output_payload: { n: 1 },
        step_index: 5,
      })
      const duplicate = yield* store
        .append({
          trajectory_id: trajectory.id,
          branch_id: "root",
          parent_ids: [],
          input_payload: { n: 2 },
          output_payload: { n: 2 },
          step_index: 5,
        })
        .pipe(Effect.flip)
      expect(duplicate).toBeInstanceOf(TrajectoryStore.NodeStepConflict)
    }))

  it.live("forks from a node into a new branch without mutating the original", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const trajectory = yield* store.create()
      const nodes = yield* makeChain(store, trajectory.id, "root", 3, trajectory.root_node_id)
      const atNode = nodes[1]!

      const fork = yield* store.fork({ trajectory_id: trajectory.id, at_node_id: atNode.id })

      expect(fork.branch_id.startsWith("brc_")).toBe(true)
      expect(fork.node.parent_ids).toEqual([atNode.id])
      expect(fork.node.branch_id).toBe(fork.branch_id)
      // Fork head continues from the fork point's output/state
      expect(fork.node.input_payload).toEqual(atNode.output_payload)
      expect(fork.node.state_snapshot).toEqual(atNode.state_snapshot)

      // Original nodes are untouched
      const original = yield* store.getNode(atNode.id)
      expect(original?.fork_ids).toEqual([])
      // Derivation is discoverable via control edges
      const children = yield* store.children(atNode.id)
      expect(children.map((node) => node.id)).toContain(fork.node.id)
    }))

  it.live("walks ancestor chains for causal path summaries", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const trajectory = yield* store.create()
      const nodes = yield* makeChain(store, trajectory.id, "root", 5, trajectory.root_node_id)
      const tail = nodes[4]!

      // max_depth caps the returned count: tail + the 3 nearest ancestors
      const ancestors = yield* store.ancestors(tail.id, { max_depth: 4 })
      expect(ancestors.map((node) => node.id)).toEqual([tail.id, nodes[3]!.id, nodes[2]!.id, nodes[1]!.id])

      const shallow = yield* store.ancestors(tail.id, { max_depth: 2 })
      expect(shallow.map((node) => node.id)).toEqual([tail.id, nodes[3]!.id])
    }))

  it.live("merges branches with matching baselines without a resolution", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const trajectory = yield* store.create()
      const root = yield* store.getNode(trajectory.root_node_id)

      const headA = yield* store.append({
        trajectory_id: trajectory.id,
        branch_id: "a",
        parent_ids: [root!.id],
        input_payload: { branch: "a" },
        output_payload: { result: "a" },
        state_snapshot: { env: { v: 1 } },
      })
      const headB = yield* store.append({
        trajectory_id: trajectory.id,
        branch_id: "b",
        parent_ids: [root!.id],
        input_payload: { branch: "b" },
        output_payload: { result: "b" },
        state_snapshot: { env: { v: 1 } },
      })

      const merged = yield* store.merge({
        trajectory_id: trajectory.id,
        branch_a: headA.id,
        branch_b: headB.id,
      })
      expect(merged.conflicted).toBe(false)
      expect(merged.node.parent_ids).toEqual([headA.id, headB.id])
      const mergedEdges = yield* store.children(headA.id)
      expect(mergedEdges.map((node) => node.id)).toContain(merged.node.id)
    }))

  it.live("requires a resolution when branch baselines diverge", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const trajectory = yield* store.create()
      const root = yield* store.getNode(trajectory.root_node_id)

      const headA = yield* store.append({
        trajectory_id: trajectory.id,
        branch_id: "a",
        parent_ids: [root!.id],
        input_payload: { branch: "a" },
        output_payload: { result: "a" },
        state_snapshot: { env: { v: 1 } },
      })
      const headB = yield* store.append({
        trajectory_id: trajectory.id,
        branch_id: "b",
        parent_ids: [root!.id],
        input_payload: { branch: "b" },
        output_payload: { result: "b" },
        state_snapshot: { env: { v: 2 } },
      })

      const conflict = yield* store
        .merge({ trajectory_id: trajectory.id, branch_a: headA.id, branch_b: headB.id })
        .pipe(Effect.flip)
      expect(conflict).toBeInstanceOf(TrajectoryStore.MergeConflict)

      const resolved = yield* store.merge({
        trajectory_id: trajectory.id,
        branch_a: headA.id,
        branch_b: headB.id,
        resolution: { output_payload: { result: "merged" }, state_snapshot: { env: { v: 2 } } },
      })
      expect(resolved.conflicted).toBe(true)
      expect(resolved.node.output_payload).toEqual({ result: "merged" })
    }))

  it.live("replays a trajectory in deterministic topological order", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const trajectory = yield* store.create()
      const nodes = yield* makeChain(store, trajectory.id, "root", 4, trajectory.root_node_id)
      // cross-branch causal dependency: branch tail depends on a main-branch node
      const fork = yield* store.fork({ trajectory_id: trajectory.id, at_node_id: nodes[1]!.id })
      yield* store.append({
        trajectory_id: trajectory.id,
        branch_id: fork.branch_id,
        parent_ids: [fork.node.id],
        input_payload: { parallel: true },
        output_payload: { parallel: "done" },
        tool_name: "webfetch",
        data_edges: [{ from_node_id: nodes[3]!.id, data_key: "content" }],
      })

      const replayed = yield* runStream(store.replay(trajectory.id))

      // Dependencies always precede dependents: the branch node that reads
      // nodes[3] output must come after nodes[3] in the topological order.
      const indexOf = (id: string) => replayed.findIndex((node) => node.id === id)
      expect(indexOf(nodes[3]!.id)).toBeGreaterThan(-1)
      const dependent = replayed.find((node) => node.parent_ids.includes(fork.node.id))
      expect(dependent).toBeDefined()
      expect(indexOf(dependent!.id)).toBeGreaterThan(indexOf(nodes[3]!.id))

      expect(replayed.length).toBe(7) // root + 4 main + fork head + branch tail
      expect(replayed[0]!.id).toBe(trajectory.root_node_id)
    }))

  test("canonicalJson is stable under key order", () => {
    expect(TrajectoryStore.canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(
      TrajectoryStore.canonicalJson({ a: { c: 3, d: 2 }, b: 1 }),
    )
    expect(TrajectoryStore.canonicalJson({ a: 1, b: [1, 2, 3] })).toBe('{"a":1,"b":[1,2,3]}')
  })
})
