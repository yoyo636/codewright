import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

/**
 * Additive-only. Every statement here tolerates an install that already has the
 * object, because drizzle-kit's generated SQL is not idempotent here: it emitted
 * a bare `CREATE TABLE policy` and a second `ALTER TABLE trajectory ADD COLUMN
 * session_id`, both of which already exist on any install built by the earlier
 * migrations. Since each migration runs exactly once per database
 * (see migration.ts journal), replaying that SQL verbatim would abort startup
 * with "table policy already exists".
 *
 * What this adds:
 *
 *   - `trajectory.task_class` — assigns every graph to an intent-equivalence
 *     class. Without it `Evolution.convergence` has nothing to compare a graph
 *     against, because convergence is defined across graphs of one class.
 *   - `policy.hits/misses/last_used_at` — grades each distilled policy against
 *     what actually happened. A distilled policy is a hypothesis from one
 *     good/bad pair; these counters are what let it be falsified instead of
 *     steering future runs forever on stale evidence.
 */
export default {
  id: "20260930094249_add_trajectory_task_class_and_policy_lifecycle",
  up(tx) {
    return Effect.gen(function* () {
      const columns = Effect.fn("Migration.columns")(function* (table: string) {
        const rows = yield* tx.all<{ name: string }>(`PRAGMA table_info(\`${table}\`)`)
        return new Set(rows.map((row) => row.name))
      })

      const trajectory = yield* columns("trajectory")
      if (!trajectory.has("session_id")) {
        yield* tx.run(`ALTER TABLE \`trajectory\` ADD COLUMN \`session_id\` text`)
      }
      if (!trajectory.has("task_class")) {
        yield* tx.run(`ALTER TABLE \`trajectory\` ADD COLUMN \`task_class\` text`)
      }
      yield* tx.run(`CREATE INDEX IF NOT EXISTS \`trajectory_task_class_idx\` ON \`trajectory\` (\`task_class\`)`)
      yield* tx.run(`CREATE INDEX IF NOT EXISTS \`trajectory_session_id_idx\` ON \`trajectory\` (\`session_id\`)`)

      yield* tx.run(`
        CREATE TABLE IF NOT EXISTS \`policy\` (
          \`id\` text PRIMARY KEY,
          \`state_hash\` text NOT NULL,
          \`task_class\` text NOT NULL,
          \`tool_sequence\` text,
          \`validated\` integer DEFAULT 0 NOT NULL,
          \`generation\` integer,
          \`trajectory_id\` text,
          \`hits\` integer DEFAULT 0 NOT NULL,
          \`misses\` integer DEFAULT 0 NOT NULL,
          \`last_used_at\` integer,
          \`time_created\` integer NOT NULL
        )
      `)

      const policy = yield* columns("policy")
      if (!policy.has("hits")) {
        yield* tx.run(`ALTER TABLE \`policy\` ADD COLUMN \`hits\` integer DEFAULT 0 NOT NULL`)
      }
      if (!policy.has("misses")) {
        yield* tx.run(`ALTER TABLE \`policy\` ADD COLUMN \`misses\` integer DEFAULT 0 NOT NULL`)
      }
      if (!policy.has("last_used_at")) {
        yield* tx.run(`ALTER TABLE \`policy\` ADD COLUMN \`last_used_at\` integer`)
      }

      yield* tx.run(
        `CREATE UNIQUE INDEX IF NOT EXISTS \`policy_state_task_idx\` ON \`policy\` (\`state_hash\`, \`task_class\`)`,
      )
      yield* tx.run(`CREATE INDEX IF NOT EXISTS \`policy_state_hash_idx\` ON \`policy\` (\`state_hash\`)`)
      yield* tx.run(`CREATE INDEX IF NOT EXISTS \`policy_task_class_idx\` ON \`policy\` (\`task_class\`)`)
    })
  },
} satisfies DatabaseMigration.Migration
