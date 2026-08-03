// CLI entry point for `opencode logs`.
//
// Surfaces the opencode log file (written by the file logger in
// `@opencode-ai/core/observability/logging`) so users can debug problems without
// having to know where the logs live. `--path` prints the file location; `--tail`
// prints the last N lines (default 50).
import type { Argv } from "yargs"
import fs from "fs/promises"
import path from "path"
import { EOL } from "os"
import { UI } from "../ui"
import { Global } from "@opencode-ai/core/global"

interface LogsArgs {
  path: boolean
  tail: number
}

function logFile() {
  return path.join(Global.Path.log, "opencode.log")
}

export const LogsCommand = {
  command: "logs",
  describe: "view the opencode log file",
  builder: (yargs: Argv) =>
    yargs
      .option("path", {
        type: "boolean",
        describe: "print the log file path and exit",
        default: false,
      })
      .option("tail", {
        alias: "n",
        type: "number",
        describe: "number of lines to print from the end of the log",
        default: 50,
      }),

  handler: async (args: LogsArgs) => {
    const file = logFile()

    if (args.path) {
      process.stdout.write(file + EOL)
      return
    }

    const exists = await fs
      .access(file)
      .then(() => true)
      .catch(() => false)
    if (!exists) {
      UI.error(`No log file found at ${file}. Run opencode once first to create it.`)
      process.exitCode = 1
      return
    }

    const content = await fs.readFile(file, "utf8")
    const lines = content.split("\n")
    // Drop the trailing empty element produced by a final newline.
    if (lines.length && lines[lines.length - 1] === "") lines.pop()
    const count = Math.max(1, args.tail)
    const tail = lines.slice(-count)
    if (tail.length) process.stdout.write(tail.join("\n") + EOL)
  },
}
