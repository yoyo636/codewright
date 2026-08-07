import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import * as BackgroundShell from "./shell/background"
import DESCRIPTION from "./kill-shell.txt"

export const Parameters = Schema.Struct({
  shell_id: Schema.String.annotate({
    description: "The ID of the background shell to terminate",
  }),
})

export const KillShellTool = Tool.define(
  "kill-shell",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>) =>
        Effect.gen(function* () {
          const info = BackgroundShell.kill(params.shell_id)
          if (!info) {
            return {
              title: `Shell ${params.shell_id}`,
              metadata: { status: undefined as string | undefined, exitCode: null as number | null },
              output: `No background shell found with ID: ${params.shell_id}.`,
            }
          }

          const output = info.output || "(no output)"
          return {
            title: info.command,
            metadata: { status: info.status, exitCode: info.exitCode },
            output: `${output}\n\n[Shell terminated. Status: ${info.status}]`,
          }
        }),
    }
  }),
)
