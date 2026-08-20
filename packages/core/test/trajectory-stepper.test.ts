import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { AppNodeBuilder } from "@codewright-ai/core/effect/app-node-builder"
import { LayerNode } from "@codewright-ai/core/effect/layer-node"
import { Database } from "@codewright-ai/core/database/database"
import { NodeStepper, StateStore, TrajectoryStore } from "@codewright-ai/core/trajectory"
import { testEffect } from "./lib/effect"

const withStore = AppNodeBuilder.build(
  LayerNode.group([TrajectoryStore.node, StateStore.node, NodeStepper.node]),
  [[Database.node, Database.layerFromPath(":memory:")]],
)

const it = testEffect(withStore)

describe("NodeStepper", () => {
  it.live("executes one node per step and persists state snapshots", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const stepper = yield* NodeStepper.Service
      const stateStore = yield* StateStore.Service
      const trajectory = yield* store.create()

      const calls: number[] = []
      const executor = {
        execute: (input: NodeStepper.StepExecuteInput) =>
          Effect.gen(function* () {
            const counter = (input.state_snapshot?.counter as number | undefined) ?? 0
            calls.push(counter)
            return {
              output_payload: { counter: counter + 1 },
              state_snapshot: { counter: counter + 1 },
              tool_name: "stepper-test",
              resource_usage: { time_ms: 1 },
            }
          }),
      }

      const first = yield* stepper.step({
        trajectory_id: trajectory.id,
        branch_id: "root",
        parent_ids: [trajectory.root_node_id],
        input_payload: { tick: 0 },
        executor,
      })
      const second = yield* stepper.step({
        trajectory_id: trajectory.id,
        branch_id: "root",
        parent_ids: [first.id],
        input_payload: { tick: 1 },
        executor,
      })

      // state was externalized per node and rebuilt from the parent chain
      expect(first.step_index).toBe(1)
      expect(second.step_index).toBe(2)
      expect(calls).toEqual([0, 1])
      expect(second.state_snapshot).toEqual({ counter: 2 })

      // in-memory state reflects the last snapshot
      expect(yield* stateStore.get("counter")).toBe(2)

      // persisted nodes are independently reconstructable
      const restored = yield* stepper.restoreState(trajectory.id, second.id)
      expect(restored).toEqual({ counter: 2 })
    }))

  it.live("reports step failures as StepError and leaves no partial node", () =>
    Effect.gen(function* () {
      const store = yield* TrajectoryStore.Service
      const stepper = yield* NodeStepper.Service
      const trajectory = yield* store.create()

      const failing: NodeStepper.StepExecutor = {
        execute: () => Effect.fail(new Error("boom")),
      }
      const failure = yield* stepper
        .step({
          trajectory_id: trajectory.id,
          branch_id: "root",
          parent_ids: [trajectory.root_node_id],
          input_payload: { fail: true },
          executor: failing,
        })
        .pipe(Effect.flip)
      expect(failure).toBeInstanceOf(NodeStepper.StepError)

      // no node was appended for the failed step (root only)
      const rootChildren = yield* store.children(trajectory.root_node_id)
      expect(rootChildren).toEqual([])
    }))
})
