export * as SelfEvolution from "./self-evolution"

import { Context, Effect, Layer } from "effect"
import { makeGlobalNode } from "../effect/app-node"
import { TrajectorySchema } from "./schema"
import { Evolution } from "./evolution"
import { PolicyStore } from "./policy-store"
import type { GraphInput } from "./evolution"

export interface EvolveInput {
  readonly task_class: string
  readonly good: GraphInput
  readonly bad: GraphInput
}

export interface EvolveResult {
  readonly policies: readonly TrajectorySchema.Policy[]
  readonly shortcuts: readonly {
    readonly from_node_id: string
    readonly to_node_id: string
    readonly kind: "shortcut"
  }[]
}

export interface Interface {
  /**
   * Close the self-evolution loop: distill the good suffix a bad graph never
   * took, then persist the resulting policies so the runner can consume them
   * on the next run of the same task class. This is the only write path into
   * the policy table — policies are never hand-written.
   */
  readonly evolve: (input: EvolveInput) => Effect.Effect<EvolveResult>
}

export class Service extends Context.Service<Service, Interface>()("@codewright/v2/trajectory/SelfEvolution") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const evolution = yield* Evolution.Service
    const policyStore = yield* PolicyStore.Service

    const evolve = Effect.fn("SelfEvolution.evolve")(function* (input: EvolveInput) {
      const distilled = Evolution.distill(input)
      const policies: TrajectorySchema.Policy[] = []
      for (const policy of distilled.policies) {
        const persisted = yield* policyStore.put({
          state_hash: policy.state_hash,
          task_class: policy.task_class,
          tool_sequence: policy.tool_sequence,
          validated: policy.validated,
          generation: policy.generation,
          trajectory_id: policy.trajectory_id,
        })
        policies.push(persisted)
      }
      return { policies, shortcuts: distilled.shortcuts }
    })

    return Service.of({ evolve })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [Evolution.node, PolicyStore.node] })