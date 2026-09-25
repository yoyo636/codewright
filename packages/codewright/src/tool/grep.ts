import path from "path"
import { Effect, Schema } from "effect"
import { InstanceState } from "@/effect/instance-state"
import { FSUtil } from "@codewright-ai/core/fs-util"
import { Ripgrep } from "@codewright-ai/core/ripgrep"
import { assertExternalDirectoryEffect } from "./external-directory"
import DESCRIPTION from "./grep.txt"
import * as Tool from "./tool"

export const Parameters = Schema.Struct({
  pattern: Schema.String.annotate({ description: "The regex pattern to search for in file contents" }),
  path: Schema.optional(Schema.String).annotate({
    description: "The directory to search in. Defaults to the current working directory.",
  }),
  include: Schema.optional(Schema.String).annotate({
    description: 'File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")',
  }),
  output_mode: Schema.optional(Schema.Literals(["content", "files_with_matches", "count"])).annotate({
    description:
      "Output mode: content (default, shows matching lines), files_with_matches (only file paths), count (match count per file)",
  }),
  before_context: Schema.optional(Schema.Number).annotate({
    description: "Lines to show before each match (ripgrep -B)",
  }),
  after_context: Schema.optional(Schema.Number).annotate({
    description: "Lines to show after each match (ripgrep -A)",
  }),
  head_limit: Schema.optional(Schema.Number).annotate({
    description: "Maximum number of matches to return",
  }),
  multiline: Schema.optional(Schema.Boolean).annotate({
    description: "Enable multiline regex mode (ripgrep -U)",
  }),
  type: Schema.optional(Schema.String).annotate({
    description: 'File type filter (ripgrep -t, e.g. "ts", "py", "md")',
  }),
})

export const GrepTool = Tool.define(
  "grep",
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const ripgrep = yield* Ripgrep.Service
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (
        params: {
          pattern: string
          path?: string
          include?: string
          output_mode?: "content" | "files_with_matches" | "count"
          before_context?: number
          after_context?: number
          head_limit?: number
          multiline?: boolean
          type?: string
        },
        ctx: Tool.Context,
      ) =>
        Effect.gen(function* () {
          const empty = {
            title: params.pattern,
            metadata: { matches: 0, truncated: false },
            output: "No files found",
          }
          if (!params.pattern) {
            throw new Error("pattern is required")
          }

          yield* ctx.ask({
            permission: "grep",
            patterns: [params.pattern],
            always: ["*"],
            metadata: {
              pattern: params.pattern,
              path: params.path,
              include: params.include,
            },
          })

          const ins = yield* InstanceState.context
          const requested = path.isAbsolute(params.path ?? ins.directory)
            ? (params.path ?? ins.directory)
            : path.join(ins.directory, params.path ?? ".")
          const requestedInfo = yield* fs.stat(requested).pipe(Effect.catch(() => Effect.succeed(undefined)))
          yield* assertExternalDirectoryEffect(ctx, requested, {
            bypass: false,
            kind: requestedInfo?.type === "Directory" ? "directory" : "file",
          })

          const search = FSUtil.resolve(requested)
          const info = yield* fs.stat(search).pipe(Effect.catch(() => Effect.succeed(undefined)))
          const cwd = info?.type === "Directory" ? search : path.dirname(search)

          const useAdvanced =
            params.output_mode ||
            params.before_context ||
            params.after_context ||
            params.head_limit ||
            params.multiline ||
            params.type

          if (useAdvanced) {
            const args = ["--no-config", "--hidden", "--no-messages"]
            if (params.output_mode === "files_with_matches") args.push("--files-with-matches")
            if (params.output_mode === "count") args.push("--count")
            if (params.before_context) args.push(`-B`, String(params.before_context))
            if (params.after_context) args.push(`-A`, String(params.after_context))
            if (params.multiline) args.push("-U")
            if (params.type) args.push("-t", params.type)
            if (params.include) args.push(`--glob=${params.include}`)
            args.push("--glob=!**/.git/**")
            args.push("--", params.pattern, ".")

            const proc = Bun.spawnSync(["rg", ...args], {
              cwd,
              stdout: "pipe",
              stderr: "pipe",
            })
            const stdout = proc.stdout.toString("utf-8")
            const stderr = proc.stderr.toString("utf-8")

            if (proc.exitCode === 2 && stderr) {
              throw new Error(`ripgrep error: ${stderr.trim()}`)
            }

            if (!stdout || proc.exitCode === 1) return empty

            let output: string
            if (params.output_mode === "files_with_matches") {
              const files = stdout.trim().split("\n").filter(Boolean)
              output = files.map((f) => path.resolve(cwd, f)).join("\n")
              if (!output) return empty
            } else if (params.output_mode === "count") {
              output = stdout.trim()
            } else {
              const lines = stdout.split("\n")
              const limit = params.head_limit ?? 100
              const truncated = lines.length > limit
              const final = truncated ? lines.slice(0, limit) : lines
              output = final.join("\n")
              if (truncated) {
                output += `\n\n(Results truncated at ${limit} lines. Use head_limit to see more or narrow your search.)`
              }
            }

            return {
              title: params.pattern,
              metadata: { matches: 0, truncated: false },
              output,
            }
          }

          const result = yield* ripgrep.grep({
            cwd,
            pattern: params.pattern,
            include: params.include,
            limit: params.head_limit ?? 100,
          })
          if (result.length === 0) return empty

          const rows = result.map((item) => ({
            path: path.resolve(
              requestedInfo?.type === "Directory" ? requested : path.dirname(requested),
              item.entry.path,
            ),
            line: item.line,
            text: item.text,
          }))

          const limit = 100
          const truncated = rows.length === limit
          const final = rows
          if (final.length === 0) return empty

          const total = rows.length
          const hasMore = truncated || result.length === limit
          const output = [`Found ${total} matches${hasMore ? " (more matches available)" : ""}`]

          let current = ""
          for (const match of final) {
            if (current !== match.path) {
              if (current !== "") output.push("")
              current = match.path
              output.push(`${match.path}:`)
            }
            output.push(`  Line ${match.line}: ${match.text}`)
          }

          if (truncated) {
            output.push("")
            output.push("(Results truncated. Consider using a more specific path or pattern.)")
          }

          return {
            title: params.pattern,
            metadata: {
              matches: total,
              truncated,
            },
            output: output.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
