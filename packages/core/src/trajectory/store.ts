export * as TrajectoryStore from "./store"

import { and, asc, desc, eq, gte, lte, or } from "drizzle-orm"
import type { EffectDrizzleSqlite } from "@codewright-ai/effect-drizzle-sqlite"
import { Context, Effect, Layer, Schema, Stream } from "effect"
import { Database } from "../database/database"
import { makeGlobalNode } from "../effect/app-node"
import { Hash } from "../util/hash"
import { NamedError } from "../util/error"
import { NonNegativeInt } from "../schema"
import { TrajectorySchema } from "./schema"
import { TrajectoryEdgeTable, TrajectoryNodeTable, TrajectoryTable } from "./sql"

type DatabaseShape = EffectDrizzleSqlite.EffectSQLiteDatabase
type Transaction = Parameters<Parameters<DatabaseShape["transaction"]>[0]>[0]

export const NodeStepConflict = NamedError.create("TrajectoryNodeStepConflict", {
  trajectoryID: Schema.String,
  branchID: Schema.String,
  step: NonNegativeInt,
})

export const MergeConflict = NamedError.create("TrajectoryMergeConflict", {
  branchA: Schema.String,
  branchB: Schema.String,
  baselineA: Schema.String,
  baselineB: Schema.String,
})

export const TrajectoryNotFound = NamedError.create("TrajectoryNotFound", { id: Schema.String })
export const NodeNotFound = NamedError.create("TrajectoryNodeNotFound", { id: Schema.String })

export interface AppendInput {
  readonly trajectory_id: string
  readonly branch_id: string
  readonly parent_ids: readonly string[]
  readonly input_payload: TrajectorySchema.JSONValue
  readonly output_payload: TrajectorySchema.JSONValue
  readonly tool_call_id?: string
  readonly tool_name?: string
  readonly reasoning_summary?: string
  readonly state_snapshot?: TrajectorySchema.JSONValue
  readonly resource_usage?: TrajectorySchema.ResourceUsage
  readonly metadata?: Record<string, TrajectorySchema.JSONValue>
  readonly step_index?: number
  /** Explicit causal/data dependencies, in addition to control edges from parent_ids. */
  readonly data_edges?: readonly { readonly from_node_id: string; readonly data_key?: string }[]
}

export interface ForkInput {
  readonly trajectory_id: string
  readonly at_node_id: string
  readonly branch_id?: string
}

export interface ForkResult {
  readonly branch_id: string
  readonly node: TrajectorySchema.Node
}

export interface MergeInput {
  readonly trajectory_id: string
  /** Head node IDs of the two branches to merge. */
  readonly branch_a: string
  readonly branch_b: string
  /** Output/state snapshot for the merged node; required when baselines diverge. */
  readonly resolution?: {
    readonly output_payload: TrajectorySchema.JSONValue
    readonly state_snapshot?: TrajectorySchema.JSONValue
  }
  readonly reasoning_summary?: string
}

export interface MergeResult {
  readonly node: TrajectorySchema.Node
  readonly branch_id: string
  readonly conflicted: boolean
}

export interface Interface {
  readonly create: (input?: {
    readonly title?: string
    readonly resource_hash?: string
    readonly metadata?: Record<string, TrajectorySchema.JSONValue>
  }) => Effect.Effect<TrajectorySchema.Trajectory>
  readonly append: (input: AppendInput) => Effect.Effect<TrajectorySchema.Node, InstanceType<typeof NodeStepConflict>>
  readonly getTrajectory: (id: string) => Effect.Effect<TrajectorySchema.Trajectory | undefined>
  readonly getNode: (id: string) => Effect.Effect<TrajectorySchema.Node | undefined>
  readonly children: (nodeID: string) => Effect.Effect<TrajectorySchema.Node[]>
  readonly ancestors: (
    nodeID: string,
    options?: { readonly max_depth?: number },
  ) => Effect.Effect<TrajectorySchema.Node[]>
  readonly byToolName: (toolName: string) => Effect.Effect<TrajectorySchema.Node[]>
  readonly byInputFingerprint: (fingerprint: string) => Effect.Effect<TrajectorySchema.Node[]>
  readonly byDurationRange: (minMs: number, maxMs: number) => Effect.Effect<TrajectorySchema.Node[]>
  readonly fork: (input: ForkInput) => Effect.Effect<ForkResult, InstanceType<typeof TrajectoryNotFound> | InstanceType<typeof NodeNotFound>>
  readonly merge: (input: MergeInput) => Effect.Effect<MergeResult, InstanceType<typeof MergeConflict> | InstanceType<typeof NodeNotFound>>
  readonly replay: (
    trajectoryID: string,
    options?: { readonly start_node_id?: string },
  ) => Stream.Stream<TrajectorySchema.Node, InstanceType<typeof TrajectoryNotFound> | InstanceType<typeof NodeNotFound>>
}

export class Service extends Context.Service<Service, Interface>()("@codewright/v2/trajectory/Store") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service

    const decodeNode = Schema.decodeUnknownEffect(TrajectorySchema.Node)
    const decodeEdge = Schema.decodeUnknownEffect(TrajectorySchema.Edge)
    const decodeTrajectory = Schema.decodeUnknownEffect(TrajectorySchema.Trajectory)

    const fromNodeRow = (row: typeof TrajectoryNodeTable.$inferSelect) =>
      decodeNode({
        id: row.id,
        trajectory_id: row.trajectory_id,
        branch_id: row.branch_id,
        step_index: row.step_index,
        input_payload: row.input_payload,
        output_payload: row.output_payload,
        tool_call_id: row.tool_call_id ?? undefined,
        tool_name: row.tool_name ?? undefined,
        reasoning_summary: row.reasoning_summary ?? undefined,
        parent_ids: row.parent_ids,
        fork_ids: row.fork_ids,
        state_snapshot: row.state_snapshot ?? undefined,
        resource_usage:
          row.tokens === null && row.time_ms === null && row.storage_bytes === null
            ? undefined
            : {
                tokens: row.tokens ?? undefined,
                time_ms: row.time_ms ?? undefined,
                storage_bytes: row.storage_bytes ?? undefined,
              },
        metadata: row.metadata ?? undefined,
        time_created: row.time_created,
      }).pipe(Effect.orDie)

    const fromTrajectoryRow = (row: typeof TrajectoryTable.$inferSelect) =>
      decodeTrajectory({
        id: row.id,
        root_node_id: row.root_node_id,
        resource_hash: row.resource_hash,
        version: row.version,
        title: row.title ?? undefined,
        metadata: row.metadata ?? undefined,
        time_created: row.time_created,
      }).pipe(Effect.orDie)

    const loadEdges = (
      trajectoryID: string,
      nodeIDs: readonly string[],
    ): Effect.Effect<TrajectorySchema.Edge[], never> =>
      nodeIDs.length === 0
        ? Effect.succeed([])
        : Effect.gen(function* () {
            const rows = yield* db
              .select()
              .from(TrajectoryEdgeTable)
              .where(
                and(
                  eq(TrajectoryEdgeTable.trajectory_id, trajectoryID),
                  or(
                    ...nodeIDs.flatMap((id) => [
                      eq(TrajectoryEdgeTable.from_node_id, id),
                      eq(TrajectoryEdgeTable.to_node_id, id),
                    ]),
                  ),
                ),
              )
              .pipe(Effect.orDie)
            return yield* Effect.forEach(rows, (row) => decodeEdge({ ...row, data_key: row.data_key ?? undefined })).pipe(
              Effect.orDie,
            )
          })

    const writeEdges = (
      tx: Transaction,
      trajectoryID: string,
      edges: readonly {
        readonly from: string
        readonly to: string
        readonly kind: TrajectorySchema.EdgeKind
        readonly data_key?: string
      }[],
    ) =>
      Effect.gen(function* () {
        for (const edge of edges) {
          yield* tx
            .insert(TrajectoryEdgeTable)
            .values({
              id: TrajectorySchema.newEdgeID(),
              trajectory_id: trajectoryID,
              from_node_id: edge.from,
              to_node_id: edge.to,
              kind: edge.kind,
              data_key: edge.data_key,
            })
            .pipe(Effect.orDie)
        }
      })

    const getTrajectory = Effect.fn("TrajectoryStore.getTrajectory")(function* (id: string) {
      const row = yield* db.select().from(TrajectoryTable).where(eq(TrajectoryTable.id, id)).get().pipe(Effect.orDie)
      return row ? yield* fromTrajectoryRow(row) : undefined
    })

    const getNode = Effect.fn("TrajectoryStore.getNode")(function* (id: string) {
      const row = yield* db.select().from(TrajectoryNodeTable).where(eq(TrajectoryNodeTable.id, id)).get().pipe(Effect.orDie)
      return row ? yield* fromNodeRow(row) : undefined
    })

    const append = Effect.fn("TrajectoryStore.append")(function* (input: AppendInput) {
      const step = yield* Effect.gen(function* () {
        if (input.step_index !== undefined) return input.step_index
        if (input.parent_ids.length > 0) {
          let maxStep = -1
          for (const parentID of input.parent_ids) {
            const parent = yield* getNode(parentID)
            if (parent) maxStep = Math.max(maxStep, parent.step_index)
          }
          if (maxStep >= 0) return maxStep + 1
        }
        const row = yield* db
          .select()
          .from(TrajectoryNodeTable)
          .where(
            and(
              eq(TrajectoryNodeTable.trajectory_id, input.trajectory_id),
              eq(TrajectoryNodeTable.branch_id, input.branch_id),
            ),
          )
          .orderBy(desc(TrajectoryNodeTable.step_index))
          .limit(1)
          .get()
          .pipe(Effect.orDie)
        return row ? row.step_index + 1 : 0
      })

      const existing = yield* db
        .select()
        .from(TrajectoryNodeTable)
        .where(
          and(
            eq(TrajectoryNodeTable.trajectory_id, input.trajectory_id),
            eq(TrajectoryNodeTable.branch_id, input.branch_id),
            eq(TrajectoryNodeTable.step_index, step),
          ),
        )
        .get()
        .pipe(Effect.orDie)
      if (existing) {
        return yield* Effect.fail(
          new NodeStepConflict({ trajectoryID: input.trajectory_id, branchID: input.branch_id, step }),
        )
      }

      const fingerprint = Hash.sha256(canonicalJson(input.input_payload))
      const storageBytes =
        input.resource_usage?.storage_bytes ?? Buffer.byteLength(canonicalJson(input.output_payload), "utf8")
      const timeCreated = Date.now()
      const node: TrajectorySchema.Node = {
        id: TrajectorySchema.newNodeID(),
        trajectory_id: input.trajectory_id,
        branch_id: input.branch_id,
        step_index: step,
        input_payload: input.input_payload,
        output_payload: input.output_payload,
        tool_call_id: input.tool_call_id,
        tool_name: input.tool_name,
        reasoning_summary: input.reasoning_summary,
        parent_ids: [...input.parent_ids],
        fork_ids: [],
        state_snapshot: input.state_snapshot,
        resource_usage: input.resource_usage
          ? { ...input.resource_usage, storage_bytes: storageBytes }
          : { storage_bytes: storageBytes },
        metadata: input.metadata,
        time_created: timeCreated,
      }

      const insert: typeof TrajectoryNodeTable.$inferInsert = {
        id: node.id,
        trajectory_id: node.trajectory_id,
        branch_id: node.branch_id,
        step_index: node.step_index,
        tool_call_id: node.tool_call_id ?? null,
        tool_name: node.tool_name ?? null,
        input_fingerprint: fingerprint,
        input_payload: node.input_payload,
        output_payload: node.output_payload,
        reasoning_summary: node.reasoning_summary ?? null,
        parent_ids: [...node.parent_ids],
        fork_ids: [...node.fork_ids],
        state_snapshot: node.state_snapshot ?? null,
        tokens: node.resource_usage?.tokens ?? null,
        time_ms: node.resource_usage?.time_ms ?? null,
        storage_bytes: node.resource_usage?.storage_bytes ?? null,
        metadata: node.metadata ?? null,
        time_created: node.time_created,
      }
      yield* db
        .transaction((tx) =>
          Effect.gen(function* () {
            yield* tx.insert(TrajectoryNodeTable).values(insert).pipe(Effect.orDie)
            yield* writeEdges(
              tx,
              node.trajectory_id,
              node.parent_ids.map((parent) => ({ from: parent, to: node.id, kind: "control" })),
            )
            yield* writeEdges(
              tx,
              node.trajectory_id,
              (input.data_edges ?? []).map((edge) => ({
                from: edge.from_node_id,
                to: node.id,
                kind: "causal" as const,
                data_key: edge.data_key,
              })),
            )
          }),
        )
        .pipe(Effect.orDie)
      return node
    })

    const create = Effect.fn("TrajectoryStore.create")(function* (input?: {
      readonly title?: string
      readonly resource_hash?: string
      readonly metadata?: Record<string, TrajectorySchema.JSONValue>
    }) {
      const id = TrajectorySchema.newTrajectoryID()
      const timeCreated = Date.now()
      yield* db
        .insert(TrajectoryTable)
        .values({
          id,
          root_node_id: "",
          resource_hash: input?.resource_hash ?? "",
          version: 1,
          title: input?.title,
          metadata: input?.metadata ?? null,
        })
        .pipe(Effect.orDie)

      const root = yield* append({
        trajectory_id: id,
        branch_id: "root",
        parent_ids: [],
        input_payload: {},
        output_payload: {},
        metadata: { annotations: { kind: "root" } },
      }).pipe(Effect.orDie)

      yield* db
        .update(TrajectoryTable)
        .set({ root_node_id: root.id })
        .where(eq(TrajectoryTable.id, id))
        .pipe(Effect.orDie)
      return {
        id,
        root_node_id: root.id,
        resource_hash: input?.resource_hash ?? "",
        version: 1,
        title: input?.title,
        metadata: input?.metadata,
        time_created: timeCreated,
      }
    })

    const children = Effect.fn("TrajectoryStore.children")(function* (nodeID: string) {
      const rows = yield* db
        .select()
        .from(TrajectoryEdgeTable)
        .where(and(eq(TrajectoryEdgeTable.from_node_id, nodeID), eq(TrajectoryEdgeTable.kind, "control")))
        .orderBy(asc(TrajectoryEdgeTable.time_created))
        .pipe(Effect.orDie)
      const nodes: TrajectorySchema.Node[] = []
      for (const row of rows) {
        const node = yield* getNode(row.to_node_id)
        if (node) nodes.push(node)
      }
      return nodes
    })

    const ancestors = Effect.fn("TrajectoryStore.ancestors")(function* (nodeID: string, options?: {
      readonly max_depth?: number
    }) {
      const maxDepth = options?.max_depth ?? 16
      const visited = new Set<string>()
      const frontier = [nodeID]
      const result: TrajectorySchema.Node[] = []
      while (result.length < maxDepth && frontier.length > 0) {
        const next: string[] = []
        for (const id of frontier) {
          if (visited.has(id)) continue
          visited.add(id)
          const node = yield* getNode(id)
          if (!node) continue
          result.push(node)
          if (result.length >= maxDepth) break
          for (const parent of node.parent_ids) {
            if (!visited.has(parent)) next.push(parent)
          }
          const edges = yield* loadEdges(node.trajectory_id, [id])
          for (const edge of edges) {
            if (edge.to_node_id === id && !visited.has(edge.from_node_id)) next.push(edge.from_node_id)
          }
        }
        frontier.length = 0
        frontier.push(...next)
      }
      return result
    })

    const byToolName = Effect.fn("TrajectoryStore.byToolName")(function* (toolName: string) {
      const rows = yield* db
        .select()
        .from(TrajectoryNodeTable)
        .where(eq(TrajectoryNodeTable.tool_name, toolName))
        .orderBy(asc(TrajectoryNodeTable.time_created))
        .pipe(Effect.orDie)
      return yield* Effect.forEach(rows, fromNodeRow).pipe(Effect.orDie)
    })

    const byInputFingerprint = Effect.fn("TrajectoryStore.byInputFingerprint")(function* (fingerprint: string) {
      const rows = yield* db
        .select()
        .from(TrajectoryNodeTable)
        .where(eq(TrajectoryNodeTable.input_fingerprint, fingerprint))
        .orderBy(asc(TrajectoryNodeTable.time_created))
        .pipe(Effect.orDie)
      return yield* Effect.forEach(rows, fromNodeRow).pipe(Effect.orDie)
    })

    const byDurationRange = Effect.fn("TrajectoryStore.byDurationRange")(function* (minMs: number, maxMs: number) {
      const rows = yield* db
        .select()
        .from(TrajectoryNodeTable)
        .where(and(gte(TrajectoryNodeTable.time_ms, minMs), lte(TrajectoryNodeTable.time_ms, maxMs)))
        .orderBy(asc(TrajectoryNodeTable.time_created))
        .pipe(Effect.orDie)
      return yield* Effect.forEach(rows, fromNodeRow).pipe(Effect.orDie)
    })

    const fork = Effect.fn("TrajectoryStore.fork")(function* (input: ForkInput) {
      const node = yield* getNode(input.at_node_id)
      if (!node) return yield* Effect.fail(new NodeNotFound({ id: input.at_node_id }))
      if (!(yield* getTrajectory(input.trajectory_id))) {
        return yield* Effect.fail(new TrajectoryNotFound({ id: input.trajectory_id }))
      }
      const branchID = input.branch_id ?? TrajectorySchema.newBranchID()
      const head = yield* append({
        trajectory_id: input.trajectory_id,
        branch_id: branchID,
        parent_ids: [node.id],
        input_payload: node.output_payload,
        output_payload: {},
        state_snapshot: node.state_snapshot,
        metadata: { annotations: { fork_of: node.id, at_step: node.step_index } },
      }).pipe(Effect.orDie)
      return { branch_id: branchID, node: head }
    })

    const merge = Effect.fn("TrajectoryStore.merge")(function* (input: MergeInput) {
      const nodeA = yield* getNode(input.branch_a)
      const nodeB = yield* getNode(input.branch_b)
      if (!nodeA) return yield* Effect.fail(new NodeNotFound({ id: input.branch_a }))
      if (!nodeB) return yield* Effect.fail(new NodeNotFound({ id: input.branch_b }))

      const baselineA = Hash.sha256(canonicalJson(nodeA.state_snapshot ?? nodeA.output_payload))
      const baselineB = Hash.sha256(canonicalJson(nodeB.state_snapshot ?? nodeB.output_payload))
      const conflicted = baselineA !== baselineB
      if (conflicted && !input.resolution) {
        return yield* Effect.fail(
          new MergeConflict({ branchA: input.branch_a, branchB: input.branch_b, baselineA, baselineB }),
        )
      }

      const branchID = TrajectorySchema.newBranchID()
      const merged = yield* append({
        trajectory_id: input.trajectory_id,
        branch_id: branchID,
        parent_ids: [nodeA.id, nodeB.id],
        input_payload: { branch_a: nodeA.output_payload, branch_b: nodeB.output_payload },
        output_payload: input.resolution?.output_payload ?? {},
        state_snapshot: input.resolution?.state_snapshot ?? nodeA.state_snapshot,
        reasoning_summary: input.reasoning_summary,
        metadata: { annotations: { merge: { a: nodeA.id, b: nodeB.id, conflicted } } },
      }).pipe(Effect.orDie)
      return { node: merged, branch_id: branchID, conflicted }
    })

    const replay = (trajectoryID: string, options?: { readonly start_node_id?: string }) =>
      Stream.fromEffect(
        Effect.gen(function* () {
          const trajectory = yield* getTrajectory(trajectoryID)
          const start =
            options?.start_node_id ??
            (trajectory
              ? trajectory.root_node_id
              : yield* Effect.fail(new TrajectoryNotFound({ id: trajectoryID })))
          const startNode = yield* getNode(start)
          if (!startNode) return yield* Effect.fail(new NodeNotFound({ id: start }))

          const rows = yield* db
            .select()
            .from(TrajectoryNodeTable)
            .where(eq(TrajectoryNodeTable.trajectory_id, trajectoryID))
            .pipe(Effect.orDie)
          const edges = yield* loadEdges(
            trajectoryID,
            rows.map((row) => row.id),
          )

          // Connected component around `start`: dependencies (reverse edges)
          // plus dependents (forward edges), emitted in deterministic
          // topological order so replay never runs a node before its inputs.
          const reverseAdjacency = new Map<string, string[]>()
          const forwardAdjacency = new Map<string, string[]>()
          for (const edge of edges) {
            reverseAdjacency.set(edge.to_node_id, [...(reverseAdjacency.get(edge.to_node_id) ?? []), edge.from_node_id])
            forwardAdjacency.set(edge.from_node_id, [...(forwardAdjacency.get(edge.from_node_id) ?? []), edge.to_node_id])
          }

          const closure = new Set<string>([start])
          const stack = [start]
          while (stack.length > 0) {
            const id = stack.pop()
            if (id === undefined) break
            for (const next of [...(reverseAdjacency.get(id) ?? []), ...(forwardAdjacency.get(id) ?? [])]) {
              if (!closure.has(next)) {
                closure.add(next)
                stack.push(next)
              }
            }
          }

          const byID = new Map(rows.map((row) => [row.id, row]))
          const indegree = new Map<string, number>()
          for (const id of closure) indegree.set(id, 0)
          for (const edge of edges) {
            if (closure.has(edge.from_node_id) && closure.has(edge.to_node_id)) {
              indegree.set(edge.to_node_id, (indegree.get(edge.to_node_id) ?? 0) + 1)
            }
          }

          const ready = [...indegree.entries()]
            .filter(([, degree]) => degree === 0)
            .map(([id]) => id)
            .sort()
          const ordered: TrajectorySchema.Node[] = []
          const enqueueSorted = (id: string) => {
            const index = ready.findIndex((candidate) => candidate > id)
            if (index === -1) ready.push(id)
            else ready.splice(index, 0, id)
          }
          while (ready.length > 0) {
            const id = ready.shift()
            if (id === undefined) break
            const row = byID.get(id)
            if (row) ordered.push(yield* fromNodeRow(row))
            for (const to of forwardAdjacency.get(id) ?? []) {
              if (!closure.has(to)) continue
              const next = (indegree.get(to) ?? 1) - 1
              indegree.set(to, next)
              if (next === 0) enqueueSorted(to)
            }
          }
          return ordered
        }),
      ).pipe(Stream.flatMap((nodes) => Stream.fromIterable(nodes)))

    return Service.of({
      create,
      append,
      getTrajectory,
      getNode,
      children,
      ancestors,
      byToolName,
      byInputFingerprint,
      byDurationRange,
      fork,
      merge,
      replay,
    })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [Database.node] })

/** Canonical JSON serialization with sorted object keys, for stable fingerprints. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}
