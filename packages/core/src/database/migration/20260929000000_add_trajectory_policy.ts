import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

/**
 * A `policy` is the unit of self-evolution: "in state S on task class T,
 * prefer this tool sequence". Policies are produced by the graph-differential
 * self-evolution loop (Evolution.distill) when it aligns a bad graph against
 * a good one of the same task class, and consumed by the runner before each
 * step (Evolution.lookup) to skip a validated prefix.
 */
export default {
  id: "20260929000000_add_trajectory_policy",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`policy\` (
          \`id\` TEXT PRIMARY KEY,
          \`state_hash\` TEXT NOT NULL,
          \`task_class\` TEXT NOT NULL,
          \`tool_sequence\` TEXT NOT NULL,
          \`validated\` INTEGER NOT NULL DEFAULT 0,
          \`generation\` INTEGER,
          \`trajectory_id\` TEXT,
          \`time_created\` INTEGER NOT NULL
        )
      `)
      yield* tx.run(`CREATE UNIQUE INDEX \`policy_state_task_idx\` ON \`policy\` (\`state_hash\`, \`task_class\`)`)
      yield* tx.run(`CREATE INDEX \`policy_state_hash_idx\` ON \`policy\` (\`state_hash\`)`)
      yield* tx.run(`CREATE INDEX \`policy_task_class_idx\` ON \`policy\` (\`task_class\`)`)
    })
  },
} satisfies DatabaseMigration.Migration