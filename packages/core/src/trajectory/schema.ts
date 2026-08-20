export * as TrajectorySchema from "./schema"

import { Schema } from "effect"
import * as Identifier from "../id/id"
import { NonNegativeInt } from "../schema"

/** JSON value type usable for payloads/snapshots (JSON-serializable by design). */
export type JSONValue = Schema.Schema.Type<typeof Schema.Json>

const TRAJECTORY_PREFIX = "traj"
const NODE_PREFIX = "tnd"
const EDGE_PREFIX = "edg"
const BRANCH_PREFIX = "brc"

export const ID = Schema.String
export type ID = Schema.Schema.Type<typeof ID>

/** Create a new ascending trajectory/node/edge/branch ID. */
export function newTrajectoryID(): string {
  return Identifier.create(TRAJECTORY_PREFIX, "ascending")
}
export function newNodeID(): string {
  return Identifier.create(NODE_PREFIX, "ascending")
}
export function newEdgeID(): string {
  return Identifier.create(EDGE_PREFIX, "ascending")
}
export function newBranchID(): string {
  return Identifier.create(BRANCH_PREFIX, "ascending")
}

export const ResourceUsage = Schema.Struct({
  tokens: Schema.optional(NonNegativeInt),
  time_ms: Schema.optional(NonNegativeInt),
  storage_bytes: Schema.optional(NonNegativeInt),
})
export type ResourceUsage = Schema.Schema.Type<typeof ResourceUsage>

/**
 * A Trajectory is an immutable first-class entity: a DAG of Nodes connected by
 * causal Edges. It replaces the linear Session/Task model as the primary
 * execution record. Trajectories are never modified in place — corrections are
 * expressed by forking and appending new nodes.
 */
export const Trajectory = Schema.Struct({
  id: Schema.String,
  /** The root node of the main (root) branch. */
  root_node_id: Schema.String,
  /** Global resource hash of the environment this trajectory was recorded against. */
  resource_hash: Schema.String,
  /** Version generation; bumps when the trajectory is forked/merged into a new generation. */
  version: NonNegativeInt,
  title: Schema.optional(Schema.String),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Json)),
  time_created: Schema.Number,
})
export type Trajectory = Schema.Schema.Type<typeof Trajectory>

/**
 * A Node is the minimal unit of a trajectory. Nodes are immutable once written;
 * every step of execution produces exactly one persisted node. A node carries
 * its own inputs, outputs, parent pointers (multi-parent for merges), fork
 * derivations, a resource consumption snapshot, and the externalized state
 * snapshot required to rebuild context when resuming from this node.
 */
export const Node = Schema.Struct({
  id: Schema.String,
  trajectory_id: Schema.String,
  /** Branch this node belongs to; forks get a fresh branch_id. */
  branch_id: Schema.String,
  /** Step index within the branch, monotonically increasing from 0. */
  step_index: NonNegativeInt,
  input_payload: Schema.Json,
  output_payload: Schema.Json,
  tool_call_id: Schema.optional(Schema.String),
  /** Tool name, secondary index target. */
  tool_name: Schema.optional(Schema.String),
  /** Chain-of-thought summary rendered at write time. */
  reasoning_summary: Schema.optional(Schema.String),
  /** Parent node pointers; multiple parents express a merge. */
  parent_ids: Schema.Array(Schema.String),
  /** Nodes forked from this node (derived index; query via control edges). */
  fork_ids: Schema.Array(Schema.String),
  /** Externalized mutable state; must never live only in memory. */
  state_snapshot: Schema.optional(Schema.Json),
  resource_usage: Schema.optional(ResourceUsage),
  /** Debug/diagnostic information lives here so logs stay queryable. */
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Json)),
  time_created: Schema.Number,
})
export type Node = Schema.Schema.Type<typeof Node>

export const EdgeKind = Schema.Literals(["causal", "data", "control", "merge"])
export type EdgeKind = Schema.Schema.Type<typeof EdgeKind>

/**
 * An Edge records an explicit data dependency between Nodes (not a time
 * order), forming the trajectory DAG. `control` edges track parent/child
 * derivation; `causal`/`data` edges carry the dependency information needed
 * for causal inference and parallel replay; `merge` edges record a fork merge.
 */
export const Edge = Schema.Struct({
  id: Schema.String,
  trajectory_id: Schema.String,
  from_node_id: Schema.String,
  to_node_id: Schema.String,
  kind: EdgeKind,
  /** For `data` edges, which output key of `from` feeds `to`. */
  data_key: Schema.optional(Schema.String),
  time_created: Schema.Number,
})
export type Edge = Schema.Schema.Type<typeof Edge>
