import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260927000000_add_trajectory_session_id",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`trajectory\` ADD COLUMN \`session_id\` text`)
      yield* tx.run(`CREATE INDEX \`trajectory_session_id_idx\` ON \`trajectory\` (\`session_id\`)`)
      // Backfill session_id from the JSON metadata for existing rows.
      yield* tx.run(`
        UPDATE \`trajectory\`
        SET \`session_id\` = json_extract(\`metadata\`, '$.session_id')
        WHERE \`session_id\` IS NULL AND \`metadata\` IS NOT NULL
      `)
    })
  },
} satisfies DatabaseMigration.Migration