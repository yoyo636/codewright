import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import * as BackgroundShell from "./shell/background"
import DESCRIPTION from "./read-output.txt"

export const Parameters = Schema.Struct({
  shell_id: Schema.String.annotate({
    description: "The ID of the background shell to read output from",
  }),
})

export const ReadOutputTool = Tool.define(
  "read-output",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>) =>
        Effect.gen(function* () {
          const info = BackgroundShell.read(params.shell_id)
          if (!info) {
            return {
              title: `Shell ${params.shell_id}`,
              metadata: { status: undefined as string | undefined, exitCode: null as number | null },
              output: `No background shell found with ID: ${params.shell_id}. Use the bash tool with run_in_background=true to start one.`,
            }
          }

          let output = info.output || "(no output yet)"
          if (info.status === "running") {
            output += `\n\n[Status: still running]`
          } else {
            output += `\n\n[Status: ${info.status}, exit code: ${info.exitCode}]`
          }

          return {
            title: info.command,
            metadata: { status: info.status, exitCode: info.exitCode },
            output,
          }
        }),
    }
  }),
)
