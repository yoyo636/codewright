import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260820131045_deep_thing",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`trajectory_edge\` (
          \`id\` text PRIMARY KEY,
          \`trajectory_id\` text NOT NULL,
          \`from_node_id\` text NOT NULL,
          \`to_node_id\` text NOT NULL,
          \`kind\` text NOT NULL,
          \`data_key\` text,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          CONSTRAINT \`fk_trajectory_edge_trajectory_id_trajectory_id_fk\` FOREIGN KEY (\`trajectory_id\`) REFERENCES \`trajectory\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`trajectory_node\` (
          \`id\` text PRIMARY KEY,
          \`trajectory_id\` text NOT NULL,
          \`branch_id\` text NOT NULL,
          \`step_index\` integer NOT NULL,
          \`tool_call_id\` text,
          \`tool_name\` text,
          \`input_fingerprint\` text,
          \`input_payload\` text NOT NULL,
          \`output_payload\` text NOT NULL,
          \`reasoning_summary\` text,
          \`parent_ids\` text NOT NULL,
          \`fork_ids\` text NOT NULL,
          \`state_snapshot\` text,
          \`tokens\` integer,
          \`time_ms\` integer,
          \`storage_bytes\` integer,
          \`metadata\` text,
          \`time_created\` integer NOT NULL,
          CONSTRAINT \`fk_trajectory_node_trajectory_id_trajectory_id_fk\` FOREIGN KEY (\`trajectory_id\`) REFERENCES \`trajectory\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`trajectory\` (
          \`id\` text PRIMARY KEY,
          \`root_node_id\` text NOT NULL,
          \`resource_hash\` text NOT NULL,
          \`version\` integer DEFAULT 1 NOT NULL,
          \`title\` text,
          \`metadata\` text,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL
        );
      `)
      yield* tx.run(`CREATE INDEX \`trajectory_edge_trajectory_idx\` ON \`trajectory_edge\` (\`trajectory_id\`);`)
      yield* tx.run(
        `CREATE INDEX \`trajectory_edge_from_idx\` ON \`trajectory_edge\` (\`trajectory_id\`,\`from_node_id\`);`,
      )
      yield* tx.run(
        `CREATE INDEX \`trajectory_edge_to_idx\` ON \`trajectory_edge\` (\`trajectory_id\`,\`to_node_id\`);`,
      )
      yield* tx.run(
        `CREATE UNIQUE INDEX \`trajectory_node_branch_step_idx\` ON \`trajectory_node\` (\`trajectory_id\`,\`branch_id\`,\`step_index\`);`,
      )
      yield* tx.run(`CREATE INDEX \`trajectory_node_trajectory_idx\` ON \`trajectory_node\` (\`trajectory_id\`);`)
      yield* tx.run(
        `CREATE INDEX \`trajectory_node_branch_idx\` ON \`trajectory_node\` (\`trajectory_id\`,\`branch_id\`);`,
      )
      yield* tx.run(`CREATE INDEX \`trajectory_node_tool_name_idx\` ON \`trajectory_node\` (\`tool_name\`);`)
      yield* tx.run(
        `CREATE INDEX \`trajectory_node_input_fingerprint_idx\` ON \`trajectory_node\` (\`input_fingerprint\`);`,
      )
      yield* tx.run(`CREATE INDEX \`trajectory_node_time_ms_idx\` ON \`trajectory_node\` (\`time_ms\`);`)
    })
  },
} satisfies DatabaseMigration.Migration
