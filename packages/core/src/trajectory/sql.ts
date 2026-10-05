import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../database/schema.sql"
import type { TrajectorySchema } from "./schema"

/**
 * Trajectory persistence. All writes are append-only: rows are created once
 * and never updated in place. Corrections are expressed by forking and
 * appending new nodes (see TrajectoryStore).
 */

export const TrajectoryTable = sqliteTable("trajectory", {
  id: text().primaryKey().$type<TrajectorySchema.ID>(),
  root_node_id: text().notNull(),
  resource_hash: text().notNull(),
  version: integer().notNull().default(1),
  title: text(),
  metadata: text({ mode: "json" }).$type<Record<string, unknown>>(),
  session_id: text(),
  /**
   * Stable intent this trajectory pursues (`sha256(agent:title)`). Two
   * trajectories of the same class are comparable, which is what makes
   * convergence measurable — see the `task_class` index below and
   * `TrajectoryStore.byTaskClass`.
   */
  task_class: text(),
  ...Timestamps,
}, (table) => [
  /** Supports `TrajectoryStore.byTaskClass`, which compares same-intent graphs. */
  index("trajectory_task_class_idx").on(table.task_class),
])

export const TrajectoryNodeTable = sqliteTable(
  "trajectory_node",
  {
    id: text().primaryKey().$type<TrajectorySchema.ID>(),
    trajectory_id: text()
      .notNull()
      .$type<TrajectorySchema.ID>()
      .references(() => TrajectoryTable.id, { onDelete: "cascade" }),
    branch_id: text().notNull(),
    /** Monotonic step within (trajectory, branch); uniqueness enforces append-only. */
    step_index: integer().notNull(),
    tool_call_id: text(),
    tool_name: text(),
    /** sha256 of the canonicalized input payload; secondary index target. */
    input_fingerprint: text(),
    input_payload: text({ mode: "json" }).notNull(),
    output_payload: text({ mode: "json" }).notNull(),
    reasoning_summary: text(),
    parent_ids: text({ mode: "json" }).notNull().$type<string[]>(),
    fork_ids: text({ mode: "json" }).notNull().$type<string[]>(),
    state_snapshot: text({ mode: "json" }).$type<unknown>(),
    tokens: integer(),
    time_ms: integer(),
    storage_bytes: integer(),
    metadata: text({ mode: "json" }).$type<Record<string, unknown>>(),
    time_created: integer()
      .notNull()
      .$default(() => Date.now()),
  },
  (table) => [
    uniqueIndex("trajectory_node_branch_step_idx").on(table.trajectory_id, table.branch_id, table.step_index),
    index("trajectory_node_trajectory_idx").on(table.trajectory_id),
    index("trajectory_node_branch_idx").on(table.trajectory_id, table.branch_id),
    index("trajectory_node_tool_name_idx").on(table.tool_name),
    index("trajectory_node_input_fingerprint_idx").on(table.input_fingerprint),
    index("trajectory_node_time_ms_idx").on(table.time_ms),
  ],
)

export const TrajectoryEdgeTable = sqliteTable(
  "trajectory_edge",
  {
    id: text().primaryKey().$type<TrajectorySchema.ID>(),
    trajectory_id: text()
      .notNull()
      .$type<TrajectorySchema.ID>()
      .references(() => TrajectoryTable.id, { onDelete: "cascade" }),
    from_node_id: text().notNull(),
    to_node_id: text().notNull(),
    kind: text().notNull().$type<TrajectorySchema.EdgeKind>(),
    data_key: text(),
    ...Timestamps,
  },
  (table) => [
    index("trajectory_edge_trajectory_idx").on(table.trajectory_id),
    index("trajectory_edge_from_idx").on(table.trajectory_id, table.from_node_id),
    index("trajectory_edge_to_idx").on(table.trajectory_id, table.to_node_id),
  ],
)

/**
 * A policy is the unit of self-evolution: "in state S on task class T, prefer
 * this tool sequence". Produced by `Evolution.distill` from a good/bad graph
 * pair and consumed by the runner before each step to skip a validated prefix.
 * Unique on (state_hash, task_class) so re-distilling the same state refreshes
 * the sequence instead of duplicating it.
 */
export const PolicyTable = sqliteTable(
  "policy",
  {
    id: text().primaryKey().$type<TrajectorySchema.ID>(),
    state_hash: text().notNull(),
    task_class: text().notNull(),
    tool_sequence: text({ mode: "json" }).$type<readonly string[]>(),
    validated: integer().notNull().default(0),
    generation: integer(),
    trajectory_id: text(),
    /**
     * Lifecycle counters. A validated policy is a hypothesis, not a fact: it was
     * distilled from one good/bad pair at one point in time. These fields let
     * the runner grade that hypothesis against reality, and `PolicyStore.demote`
     * retires one whose predictions stop paying off.
     */
    /** Steps that followed the sequence and settled successfully. */
    hits: integer().notNull().default(0),
    /** Steps that followed the sequence and did not settle successfully. */
    misses: integer().notNull().default(0),
    /** Timestamp of the last recorded outcome. */
    last_used_at: integer(),
    time_created: integer().notNull().$default(() => Date.now()),
  },
  (table) => [
    uniqueIndex("policy_state_task_idx").on(table.state_hash, table.task_class),
    index("policy_state_hash_idx").on(table.state_hash),
    index("policy_task_class_idx").on(table.task_class),
  ],
)
