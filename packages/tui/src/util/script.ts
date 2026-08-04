import { readFileSync, existsSync } from "node:fs"
import { basename, extname } from "node:path"

export type ScriptStepKind = "prompt" | "command" | "wait" | "label" | "goto" | "exit"

export interface ScriptStep {
  kind: ScriptStepKind
  raw: string
  args: string
  lineno: number
}

export interface ParsedScript {
  name: string
  path: string
  steps: ScriptStep[]
  labels: Record<string, number>
  description?: string
}

export interface ScriptRunResult {
  ok: boolean
  step: ScriptStep
  output: string
  lineno: number
}

function parseHeaderLine(line: string): { key: string; value: string } | null {
  const m = line.match(/^#\s*@(\w+)\s*:\s*(.+)$/)
  if (!m) return null
  return { key: m[1].toLowerCase(), value: m[2].trim() }
}

export function parseScript(text: string, path: string): ParsedScript {
  const lines = text.split(/\r?\n/)
  const steps: ScriptStep[] = []
  const labels: Record<string, number> = {}
  let description: string | undefined
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith("#!")) continue
    if (trimmed.startsWith("#")) {
      const header = parseHeaderLine(trimmed)
      if (header?.key === "description") description = header.value
      continue
    }
    if (trimmed.startsWith(":")) {
      const name = trimmed.slice(1).split(/\s+/)[0]
      labels[name] = steps.length
      continue
    }
    if (trimmed.startsWith(">")) {
      steps.push({ kind: "prompt", raw, args: trimmed.slice(1).trim(), lineno: i + 1 })
      continue
    }
    if (trimmed.startsWith("$")) {
      steps.push({ kind: "command", raw, args: trimmed.slice(1).trim(), lineno: i + 1 })
      continue
    }
    if (trimmed.startsWith("wait ")) {
      steps.push({ kind: "wait", raw, args: trimmed.slice(5).trim(), lineno: i + 1 })
      continue
    }
    if (trimmed.startsWith("goto ")) {
      steps.push({ kind: "goto", raw, args: trimmed.slice(5).trim(), lineno: i + 1 })
      continue
    }
    if (trimmed === "exit") {
      steps.push({ kind: "exit", raw, args: "", lineno: i + 1 })
      continue
    }
    steps.push({ kind: "prompt", raw, args: trimmed, lineno: i + 1 })
  }
  return {
    name: basename(path, extname(path)),
    path,
    steps,
    labels,
    description,
  }
}

export function loadScript(path: string): ParsedScript {
  if (!existsSync(path)) throw new Error(`script not found: ${path}`)
  const text = readFileSync(path, "utf8")
  return parseScript(text, path)
}

export function isScriptPath(path: string): boolean {
  const ext = extname(path).toLowerCase()
  return ext === ".cwscript" || ext === ".cws" || ext === ".script"
}
