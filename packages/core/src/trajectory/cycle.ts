export * as EvolutionCycle from "./cycle"

import { Context, Effect, Layer } from "effect"
import { makeGlobalNode } from "../effect/app-node"
import { TrajectorySchema } from "./schema"
import { TrajectoryStore } from "./store"
import { Evolution, type GraphInput } from "./evolution"
import { PolicyStore } from "./policy-store"
import { SelfEvolution } from "./self-evolution"
import { Adversary } from "./adversary"

/**
 * The self-evolution loop driver.
 *
 * Everything downstream of this node already existed and was tested in
 * isolation — `Evolution.distill` turns a good/bad graph pair into a policy,
 * `PolicyStore` persists it, and the runner consumes policies before each step.
 * But nothing called any of it outside tests, so the policy table stayed empty
 * forever and the "self-evolving agent" was a closed loop that never closed.
 *
 * `run` is what turns those pieces into a loop:
 *
 *   1. gather every trajectory of one task class
 *   2. score each against its peers (`Evolution.score`, which includes the
 *      convergence term — that is what makes step 3 stable rather than arbitrary)
 *   3. take the best as exemplar, the worst as counter-example, distill
 *
 * With only one graph available there is nothing to compare, so the loop
 * cold-starts by manufacturing its own counter-example with `Adversary`: it
 * perturbs the single observed graph into the failure modes the fitness signal
 * cares about (reordering, detours, failures with no retry) and distills against
 * that. A first run therefore produces a policy immediately instead of waiting
 * for the user to repeat the task badly enough to generate a natural bad graph.
 */

export interface CycleInput {
  readonly taskClass: string
  /** Cap on how many recent trajectories of the class are compared. */
  readonly limit?: number
  /** Skip persisting when the best and worst graphs score within this distance. */
  readonly minScoreGap?: number
}

export interface CycleResult {
  readonly compared: number
  readonly policies: readonly TrajectorySchema.Policy[]
  readonly shortcuts: readonly { readonly from_node_id: string; readonly to_node_id: string; readonly kind: "shortcut" }[]
  /** True when the counter-example was synthesized rather than observed. */
  readonly synthetic: boolean
}

export interface Interface {
  readonly run: (input: CycleInput) => Effect.Effect<CycleResult>
}

export class Service extends Context.Service<Service, Interface>()("@codewright/v2/trajectory/EvolutionCycle") {}

const loadGraph = Effect.fn("EvolutionCycle.loadGraph")(function* (store: TrajectoryStore.Interface, evolution: Evolution.Interface, id: string) {
  const trajectory = yield* store.getTrajectory(id)
  if (!trajectory) return undefined
  const nodes = yield* store.nodes(id)
  return { trajectory, nodes, edges: yield* evolution.edges(id) } satisfies GraphInput
})

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const store = yield* TrajectoryStore.Service
    const evolution = yield* Evolution.Service
    const policyStore = yield* PolicyStore.Service
    const self = yield* SelfEvolution.Service

    const run = Effect.fn("EvolutionCycle.run")(function* (input: CycleInput) {
      const trajectories = yield* store.byTaskClass(input.taskClass, { limit: input.limit ?? 16 })
      const graphs: GraphInput[] = []
      for (const trajectory of trajectories) {
        const graph = yield* loadGraph(store, evolution, trajectory.id)
        if (graph) graphs.push(graph)
      }
      if (graphs.length === 0) return { compared: 0, policies: [], shortcuts: [], synthetic: false }

      // Peers are every graph of the class, so each score includes a
      // convergence term rather than being a purely topological judgement.
      const scored = graphs
        .map((graph) => ({ graph, score: evolution.score({ ...graph, peers: graphs, graph }) }))
        .sort((a, b) => b.score - a.score)

      const best = scored[0]!
      const worst = scored[scored.length - 1]!

      let good = best.graph
      let bad = worst.graph
      let synthetic = false

      if (graphs.length === 1 || Math.abs(best.score - worst.score) < (input.minScoreGap ?? 0.25)) {
        // No meaningful spread: either this is the first observed graph, or
        // every run of this class looks alike. Manufacture the failure modes
        // anyway so distillation has something to learn the complement of.
        synthetic = true
        const variants = Adversary.perturb({ graph: best.graph, task_class: input.taskClass })
        const low = variants
          .slice(1)
          .map((variant) => ({ variant, score: evolution.score({ ...variant, peers: [best.graph, ...variants.slice(1)], graph: variant }) }))
          .sort((a, b) => a.score - b.score)[0]
        if (low) bad = low.variant
      }

      const result = yield* self.evolve({ task_class: input.taskClass, good, bad })

      // Retire policies of this class that have been followed often enough to
      // judge and have stopped paying off. Doing it here keeps demotion tied to
      // the same pass that proposes replacements.
      yield* policyStore.demote({ taskClass: input.taskClass, floor: 0.5, minSamples: 5 })

      return {
        compared: graphs.length,
        policies: result.policies,
        shortcuts: result.shortcuts,
        synthetic,
      }
    })

    return Service.of({ run })
  }),
)

export const node = makeGlobalNode({
  service: Service,
  layer,
  deps: [TrajectoryStore.node, Evolution.node, PolicyStore.node, SelfEvolution.node],
})
