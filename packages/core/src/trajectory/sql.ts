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
  ...Timestamps,
})

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
