export * as StateStore from "./state-store"

import { Context, Effect, Layer } from "effect"
import { makeGlobalNode } from "../effect/app-node"
import { TrajectorySchema } from "./schema"

/**
 * StateStore externalizes all mutable execution state out of memory.
 * A state snapshot is JSON-serializable and is persisted as a Node's
 * `state_snapshot`; resuming execution rebuilds context by restoring the
 * snapshot captured along the parent chain.
 */

export type StateSnapshot = Record<string, TrajectorySchema.JSONValue>

export interface Interface {
  readonly get: (key: string) => Effect.Effect<TrajectorySchema.JSONValue | undefined>
  readonly set: (key: string, value: TrajectorySchema.JSONValue) => Effect.Effect<void>
  readonly snapshot: () => Effect.Effect<StateSnapshot>
  readonly restore: (snapshot: StateSnapshot) => Effect.Effect<void>
  readonly clear: () => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@codewright/v2/trajectory/StateStore") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    let state: StateSnapshot = {}
    return Service.of({
      get: Effect.fn("StateStore.get")(function* (key) {
        return state[key]
      }),
      set: Effect.fn("StateStore.set")(function* (key, value) {
        state = { ...state, [key]: value }
      }),
      snapshot: Effect.fn("StateStore.snapshot")(function* () {
        return state
      }),
      restore: Effect.fn("StateStore.restore")(function* (snapshot) {
        state = { ...snapshot }
      }),
      clear: Effect.fn("StateStore.clear")(function* () {
        state = {}
      }),
    })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [] })
