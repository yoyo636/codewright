export * as PolicyStore from "./policy-store"

import { and, desc, eq } from "drizzle-orm"
import type { EffectDrizzleSqlite } from "@codewright-ai/effect-drizzle-sqlite"
import { Context, Effect, Layer, Schema } from "effect"
import { makeGlobalNode } from "../effect/app-node"
import { NamedError } from "../util/error"
import { Database } from "../database/database"
import { TrajectorySchema } from "./schema"
import { PolicyTable } from "./sql"

type DatabaseShape = EffectDrizzleSqlite.EffectSQLiteDatabase

export const PolicyNotFound = NamedError.create("TrajectoryPolicyNotFound", {
  state_hash: Schema.String,
  task_class: Schema.String,
})

export interface Interface {
  /**
   * Look up the validated policy for a (state_hash, task_class) pair.
   * Returns undefined when no policy exists yet — the runner then falls back
   * to the model's own plan.
   */
  readonly lookup: (
    state_hash: string,
    task_class: string,
  ) => Effect.Effect<TrajectorySchema.Policy | undefined>
  /** All validated policies for a task class, most recent first. */
  readonly listByTaskClass: (task_class: string) => Effect.Effect<TrajectorySchema.Policy[]>
  /** Insert or refresh a policy. Re-distilling the same state refreshes it. */
  readonly put: (policy: Omit<TrajectorySchema.Policy, "id" | "time_created">) => Effect.Effect<TrajectorySchema.Policy>
  /**
   * Grade a policy against what actually happened when it was followed. This is
   * the falsification channel: without it a policy distilled once from one
   * good/bad pair steers every future run forever, even after the codebase or
   * tool surface has moved on.
   */
  readonly recordOutcome: (
    policyID: string,
    outcome: "hit" | "miss",
  ) => Effect.Effect<TrajectorySchema.Policy | undefined>
  /**
   * Retire policies whose observed success rate has decayed below `floor` once
   * they have enough observations to judge (`minSamples`). Returns the
   * demoted policies.
   *
   * A demoted policy keeps its row — its counters are the evidence that it did
   * not work, and dropping them would let the next distillation re-propose the
   * same sequence with a clean slate.
   */
  readonly demote: (input: { readonly taskClass: string; readonly floor: number; readonly minSamples: number }) => Effect.Effect<TrajectorySchema.Policy[]>
}

export class Service extends Context.Service<Service, Interface>()("@codewright/v2/trajectory/PolicyStore") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    const decodePolicy = Schema.decodeUnknownEffect(TrajectorySchema.Policy)

    const fromRow = (row: typeof PolicyTable.$inferSelect) =>
      decodePolicy({
        id: row.id,
        state_hash: row.state_hash,
        task_class: row.task_class,
        tool_sequence: row.tool_sequence,
        validated: row.validated === 1,
        generation: row.generation ?? undefined,
        trajectory_id: row.trajectory_id ?? undefined,
        hits: row.hits,
        misses: row.misses,
        last_used_at: row.last_used_at ?? undefined,
        time_created: row.time_created,
      }).pipe(Effect.orDie)

    const lookup = Effect.fn("PolicyStore.lookup")(function* (state_hash: string, task_class: string) {
      const row = yield* db
        .select()
        .from(PolicyTable)
        .where(and(eq(PolicyTable.state_hash, state_hash), eq(PolicyTable.task_class, task_class), eq(PolicyTable.validated, 1)))
        .get()
        .pipe(Effect.orDie)
      return row ? yield* fromRow(row) : undefined
    })

    const listByTaskClass = Effect.fn("PolicyStore.listByTaskClass")(function* (task_class: string) {
      const rows = yield* db
        .select()
        .from(PolicyTable)
        .where(eq(PolicyTable.task_class, task_class))
        .orderBy(desc(PolicyTable.time_created))
        .pipe(Effect.orDie)
      return yield* Effect.forEach(rows, fromRow).pipe(Effect.orDie)
    })

    const put = Effect.fn("PolicyStore.put")(function* (input: Omit<TrajectorySchema.Policy, "id" | "time_created">) {
      const id = TrajectorySchema.newPolicyID()
      const timeCreated = Date.now()
      yield* db
        .insert(PolicyTable)
        .values({
          id,
          state_hash: input.state_hash,
          task_class: input.task_class,
          tool_sequence: [...input.tool_sequence],
          validated: input.validated ? 1 : 0,
          generation: input.generation ?? null,
          trajectory_id: input.trajectory_id ?? null,
          time_created: timeCreated,
        })
        .onConflictDoUpdate({
          target: [PolicyTable.state_hash, PolicyTable.task_class],
          set: {
            tool_sequence: [...input.tool_sequence],
            validated: input.validated ? 1 : 0,
            generation: input.generation ?? null,
            trajectory_id: input.trajectory_id ?? null,
            time_created: timeCreated,
          },
        })
        .pipe(Effect.orDie)
      return {
        id,
        state_hash: input.state_hash,
        task_class: input.task_class,
        tool_sequence: input.tool_sequence,
        validated: input.validated,
        generation: input.generation,
        trajectory_id: input.trajectory_id,
        hits: input.hits ?? 0,
        misses: input.misses ?? 0,
        last_used_at: input.last_used_at,
        time_created: timeCreated,
      }
    })

    const recordOutcome = Effect.fn("PolicyStore.recordOutcome")(function* (
      policyID: string,
      outcome: "hit" | "miss",
    ) {
      const row = yield* db
        .select()
        .from(PolicyTable)
        .where(eq(PolicyTable.id, policyID))
        .get()
        .pipe(Effect.orDie)
      if (!row) return undefined
      const timeUsed = Date.now()
      const hits = row.hits + (outcome === "hit" ? 1 : 0)
      const misses = row.misses + (outcome === "miss" ? 1 : 0)
      yield* db
        .update(PolicyTable)
        .set({ hits, misses, last_used_at: timeUsed })
        .where(eq(PolicyTable.id, policyID))
        .pipe(Effect.orDie)
      return yield* fromRow({ ...row, hits, misses, last_used_at: timeUsed })
    })

    const demote = Effect.fn("PolicyStore.demote")(function* (input: {
      readonly taskClass: string
      readonly floor: number
      readonly minSamples: number
    }) {
      const rows = yield* db
        .select()
        .from(PolicyTable)
        .where(and(eq(PolicyTable.task_class, input.taskClass), eq(PolicyTable.validated, 1)))
        .pipe(Effect.orDie)
      const demoted: TrajectorySchema.Policy[] = []
      for (const row of rows) {
        const samples = row.hits + row.misses
        if (samples < input.minSamples) continue
        if (row.hits / samples >= input.floor) continue
        yield* db
          .update(PolicyTable)
          .set({ validated: 0 })
          .where(eq(PolicyTable.id, row.id))
          .pipe(Effect.orDie)
        demoted.push(yield* fromRow({ ...row, validated: 0 }))
      }
      return demoted
    })

    return Service.of({ lookup, listByTaskClass, put, recordOutcome, demote })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [Database.node] })