export * as NodeStepper from "./stepper"

import { Context, Effect, Layer, Schema } from "effect"
import { makeGlobalNode } from "../effect/app-node"
import { NamedError } from "../util/error"
import { TrajectorySchema } from "./schema"
import { TrajectoryStore } from "./store"
import { StateStore } from "./state-store"

/**
 * Node Stepper replaces the linear main loop: each call executes exactly one
 * node and immediately persists it through TrajectoryStore. No mutable state
 * is retained in memory — context is rebuilt from the parent chain's
 * state_snapshot before each step.
 */

export const StepError = NamedError.create("TrajectoryStepError", { message: Schema.String })

export interface StepExecuteInput {
  readonly input_payload: TrajectorySchema.JSONValue
  readonly state_snapshot: StateStore.StateSnapshot | undefined
}

export interface StepExecuteOutput {
  readonly output_payload: TrajectorySchema.JSONValue
  readonly state_snapshot?: StateStore.StateSnapshot
  readonly tool_call_id?: string
  readonly tool_name?: string
  readonly reasoning_summary?: string
  readonly resource_usage?: TrajectorySchema.ResourceUsage
  readonly annotations?: Record<string, TrajectorySchema.JSONValue>
}

export interface StepExecutor {
  readonly execute: (input: StepExecuteInput) => Effect.Effect<StepExecuteOutput, unknown>
}

export interface StepInput {
  readonly trajectory_id: string
  readonly branch_id: string
  readonly parent_ids: readonly string[]
  readonly input_payload: TrajectorySchema.JSONValue
  readonly executor: StepExecutor
}

export interface Interface {
  readonly step: (input: StepInput) => Effect.Effect<TrajectorySchema.Node, InstanceType<typeof StepError>>
  /** Rebuilds state from the nearest snapshot along the parent chain. */
  readonly restoreState: (
    trajectoryID: string,
    nodeID: string,
  ) => Effect.Effect<StateStore.StateSnapshot | undefined, InstanceType<typeof TrajectoryStore.NodeNotFound>>
}

export class Service extends Context.Service<Service, Interface>()("@codewright/v2/trajectory/NodeStepper") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const store = yield* TrajectoryStore.Service
    const stateStore = yield* StateStore.Service

    const restoreState = Effect.fn("NodeStepper.restoreState")(function* (trajectoryID: string, nodeID: string) {
      const node = yield* store.getNode(nodeID)
      if (!node) return yield* Effect.fail(new TrajectoryStore.NodeNotFound({ id: nodeID }))
      if (node.state_snapshot !== undefined) return node.state_snapshot as StateStore.StateSnapshot
      const ancestors = yield* store.ancestors(nodeID, { max_depth: 64 })
      for (const ancestor of ancestors) {
        if (ancestor.state_snapshot !== undefined) return ancestor.state_snapshot as StateStore.StateSnapshot
      }
      return undefined
    })

    const step = Effect.fn("NodeStepper.step")(function* (input: StepInput) {
      const state = yield* Effect.gen(function* () {
        if (input.parent_ids.length === 0) return undefined
        const last = input.parent_ids[input.parent_ids.length - 1]
        if (!last) return undefined
        const parent = yield* store.getNode(last)
        if (parent?.state_snapshot !== undefined) return parent.state_snapshot as StateStore.StateSnapshot
        const ancestors = yield* store.ancestors(last, { max_depth: 64 })
        for (const ancestor of ancestors) {
          if (ancestor.state_snapshot !== undefined) return ancestor.state_snapshot as StateStore.StateSnapshot
        }
        return undefined
      })

      const executed = yield* input.executor
        .execute({
          input_payload: input.input_payload,
          state_snapshot: state,
        })
        .pipe(Effect.mapError((error) => new StepError({ message: `execute failed: ${String(error)}` })))

      yield* stateStore.restore(executed.state_snapshot ?? {})

      const node = yield* store
        .append({
          trajectory_id: input.trajectory_id,
          branch_id: input.branch_id,
          parent_ids: input.parent_ids,
          input_payload: input.input_payload,
          output_payload: executed.output_payload,
          tool_call_id: executed.tool_call_id,
          tool_name: executed.tool_name,
          reasoning_summary: executed.reasoning_summary,
          state_snapshot: executed.state_snapshot ?? state,
          resource_usage: executed.resource_usage,
          metadata: executed.annotations ? { annotations: executed.annotations } : undefined,
        })
        .pipe(Effect.mapError((error) => new StepError({ message: `step failed: ${error.name}` })))
      return node
    })

    return Service.of({ step, restoreState })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [TrajectoryStore.node, StateStore.node] })
