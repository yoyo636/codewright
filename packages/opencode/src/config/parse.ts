export * as ConfigParse from "./parse"

import { type ParseError as JsoncParseError, parse as parseJsoncImpl, printParseErrorCode } from "jsonc-parser"
import { Cause, Exit, Schema as EffectSchema, SchemaIssue } from "effect"
import type { DeepMutable } from "@codewright-ai/core/schema"
import { InvalidError, JsonError } from "@codewright-ai/core/v1/config/error"
import fuzzysort from "fuzzysort"

export function jsonc(text: string, filepath: string): unknown {
  const errors: JsoncParseError[] = []
  const data = parseJsoncImpl(text, errors, { allowTrailingComma: true })
  if (errors.length) {
    const lines = text.split("\n")
    const issues = errors
      .map((e) => {
        const beforeOffset = text.substring(0, e.offset).split("\n")
        const line = beforeOffset.length
        const column = beforeOffset[beforeOffset.length - 1].length + 1
        const problemLine = lines[line - 1]

        const error = `${printParseErrorCode(e.error)} at line ${line}, column ${column}`
        if (!problemLine) return error

        return `${error}\n   Line ${line}: ${problemLine}\n${"".padStart(column + 9)}^`
      })
      .join("\n")
    throw new JsonError({
      path: filepath,
      message: issues,
    })
  }

  return data
}

export function schema<S extends EffectSchema.Decoder<unknown, never>>(
  schema: S,
  data: unknown,
  source: string,
): DeepMutable<S["Type"]> {
  const extra = topLevelExtraKeys(schema, data)
  if (extra.length) {
    throw new InvalidError({
      path: source,
      issues: [
        {
          code: "unrecognized_keys",
          keys: extra,
          path: [],
          message: unrecognizedKeysMessage(extra, topLevelKnownKeys(schema)),
        },
      ],
    })
  }

  const decoded = EffectSchema.decodeUnknownExit(schema)(data, { errors: "all", propertyOrder: "original" })
  if (Exit.isSuccess(decoded)) return decoded.value as DeepMutable<S["Type"]>
  const error = Cause.squash(decoded.cause)

  throw new InvalidError(
    {
      path: source,
      issues: EffectSchema.isSchemaError(error)
        ? SchemaIssue.makeFormatterStandardSchemaV1()(error.issue).issues.map((issue) => ({
            ...issue,
            message: issue.message,
            path: issue.path?.map(String) ?? [],
          }))
        : [{ message: String(error), path: [] }],
    },
    { cause: error },
  )
}

function topLevelKnownKeys(schema: EffectSchema.Top): string[] {
  if (schema.ast._tag !== "Objects" || schema.ast.indexSignatures.length > 0) return []
  return schema.ast.propertySignatures.map((item) => String(item.name))
}

function topLevelExtraKeys(schema: EffectSchema.Top, data: unknown) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return []
  // Only run the extra-key check on plain object schemas. For unions,
  // transformations, or schemas with index signatures, defer to the Effect
  // decoder (reporting every key as "unrecognized" against an empty known set
  // would be a false positive).
  if (schema.ast._tag !== "Objects" || schema.ast.indexSignatures.length > 0) return []
  const known = new Set(topLevelKnownKeys(schema))
  return Object.keys(data).filter((key) => !known.has(key))
}

function unrecognizedKeysMessage(extra: string[], known: string[]): string {
  const parts = extra.map((key) => {
    if (!known.length) return key
    const best = fuzzysort.go(key, known, { limit: 1, threshold: -2000 })[0]
    return best && best.target !== key ? `${key} (did you mean \`${best.target}\`?)` : key
  })
  return `Unrecognized key${extra.length === 1 ? "" : "s"}: ${parts.join(", ")}`
}
