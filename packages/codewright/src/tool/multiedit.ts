import * as path from "path"
import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { LSP } from "@/lsp/lsp"
import { createTwoFilesPatch, diffLines } from "diff"
import DESCRIPTION from "./multiedit.txt"
import { FileSystem } from "@codewright-ai/core/filesystem"
import { Watcher } from "@codewright-ai/core/filesystem/watcher"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Format } from "../format"
import { InstanceState } from "@/effect/instance-state"
import { Snapshot } from "@/snapshot"
import { assertExternalDirectoryEffect } from "./external-directory"
import { FSUtil } from "@codewright-ai/core/fs-util"
import * as Bom from "@/util/bom"
import { replace, trimDiff, lock } from "./edit"

function normalizeLineEndings(text: string): string {
  return text.replaceAll("\r\n", "\n")
}

function detectLineEnding(text: string): "\n" | "\r\n" {
  return text.includes("\r\n") ? "\r\n" : "\n"
}

function convertToLineEnding(text: string, ending: "\n" | "\r\n"): string {
  if (ending === "\n") return text
  return text.replaceAll("\n", "\r\n")
}

const Edit = Schema.Struct({
  oldString: Schema.String.annotate({ description: "The text to replace" }),
  newString: Schema.String.annotate({
    description: "The text to replace it with (must be different from oldString)",
  }),
  replaceAll: Schema.optional(Schema.Boolean).annotate({
    description: "Replace all occurrences of oldString (default false)",
  }),
})

export const Parameters = Schema.Struct({
  filePath: Schema.String.annotate({ description: "The absolute path to the file to modify" }),
  edits: Schema.Array(Edit).annotate({
    description:
      "An ordered list of edits to apply sequentially. Each edit is applied to the result of the previous one. If any edit fails, no changes are applied.",
  }),
})

export const MultiEditTool = Tool.define(
  "multiedit",
  Effect.gen(function* () {
    const lsp = yield* LSP.Service
    const afs = yield* FSUtil.Service
    const format = yield* Format.Service
    const events = yield* EventV2Bridge.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          if (!params.filePath) throw new Error("filePath is required")
          if (params.edits.length === 0) throw new Error("edits cannot be empty")

          const instance = yield* InstanceState.context
          const filePath = path.isAbsolute(params.filePath)
            ? params.filePath
            : path.join(instance.directory, params.filePath)
          yield* assertExternalDirectoryEffect(ctx, filePath)

          let diff = ""
          let contentOld = ""
          let contentNew = ""

          yield* lock(filePath).withPermits(1)(
            Effect.gen(function* () {
              const info = yield* afs.stat(filePath).pipe(Effect.catch(() => Effect.succeed(undefined)))
              if (!info) throw new Error(`File ${filePath} not found`)
              if (info.type === "Directory") throw new Error(`Path is a directory, not a file: ${filePath}`)
              const source = yield* Bom.readFile(afs, filePath)
              contentOld = source.text

              const ending = detectLineEnding(contentOld)
              let working = contentOld

              for (let i = 0; i < params.edits.length; i++) {
                const edit = params.edits[i]
                if (edit.oldString === edit.newString) {
                  throw new Error(`Edit ${i + 1}: oldString and newString are identical.`)
                }
                const old = convertToLineEnding(normalizeLineEndings(edit.oldString), ending)
                const replacement = convertToLineEnding(normalizeLineEndings(edit.newString), ending)
                try {
                  working = replace(working, old, replacement, edit.replaceAll)
                } catch (e) {
                  throw new Error(`Edit ${i + 1} failed: ${(e as Error).message}`)
                }
              }

              const next = Bom.split(working)
              const desiredBom = source.bom || next.bom
              contentNew = next.text

              diff = trimDiff(
                createTwoFilesPatch(
                  filePath,
                  filePath,
                  normalizeLineEndings(contentOld),
                  normalizeLineEndings(contentNew),
                ),
              )
              yield* ctx.ask({
                permission: "edit",
                patterns: [path.relative(instance.worktree, filePath)],
                always: ["*"],
                metadata: {
                  filepath: filePath,
                  diff,
                },
              })

              yield* afs.writeWithDirs(filePath, Bom.join(contentNew, desiredBom))
              if (yield* format.file(filePath)) {
                contentNew = yield* Bom.syncFile(afs, filePath, desiredBom)
              }
              yield* events.publish(FileSystem.Event.Edited, { file: filePath })
              yield* events.publish(Watcher.Event.Updated, {
                file: filePath,
                event: "change",
              })
              diff = trimDiff(
                createTwoFilesPatch(
                  filePath,
                  filePath,
                  normalizeLineEndings(contentOld),
                  normalizeLineEndings(contentNew),
                ),
              )
            }).pipe(Effect.orDie),
          )

          let additions = 0
          let deletions = 0
          for (const change of diffLines(contentOld, contentNew)) {
            if (change.added) additions += change.count || 0
            if (change.removed) deletions += change.count || 0
          }
          const filediff: Snapshot.FileDiff = {
            file: filePath,
            patch: diff,
            additions,
            deletions,
          }

          yield* ctx.metadata({
            metadata: {
              diff,
              filediff,
              diagnostics: {},
            },
          })

          let output = `Applied ${params.edits.length} edit(s) successfully.`
          yield* lsp.touchFile(filePath, "document")
          const diagnostics = yield* lsp.diagnostics()
          const normalizedFilePath = FSUtil.normalizePath(filePath)
          const block = LSP.Diagnostic.report(filePath, diagnostics[normalizedFilePath] ?? [])
          if (block) output += `\n\nLSP errors detected in this file, please fix:\n${block}`

          return {
            metadata: {
              diagnostics,
              diff,
              filediff,
            },
            title: `${path.relative(instance.worktree, filePath)}`,
            output,
          }
        }),
    }
  }),
)
