import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { Global } from "@codewright-ai/core/global"

export interface HistoryEntry {
  id: number
  input: string
  at: number
  sessionId?: string
  exit?: "ok" | "error" | "cancelled"
}

const MAX_ENTRIES = 5_000

let cache: HistoryEntry[] | null = null
let idCounter = 0
let persistPath: string | null = null
const subscribers = new Set<() => void>()

function defaultPath(): string {
  if (persistPath) return persistPath
  persistPath = join(Global.Path.data, "tui-history.jsonl")
  return persistPath
}

function ensureLoaded(): HistoryEntry[] {
  if (cache) return cache
  cache = []
  idCounter = 0
  const path = defaultPath()
  if (!existsSync(path)) return cache
  try {
    const text = readFileSync(path, "utf8")
    for (const line of text.split("\n")) {
      if (!line.trim()) continue
      try {
        const e = JSON.parse(line) as HistoryEntry
        cache.push(e)
        if (e.id > idCounter) idCounter = e.id
      } catch {
        /* ignore malformed lines */
      }
    }
  } catch {
    /* ignore */
  }
  return cache
}

function persist() {
  const path = defaultPath()
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, cache!.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8")
  } catch {
    /* ignore persistence errors */
  }
}

function notify() {
  for (const s of subscribers) {
    try {
      s()
    } catch {
      /* ignore */
    }
  }
}

export function pushHistory(input: string, opts?: { sessionId?: string; exit?: HistoryEntry["exit"] }): HistoryEntry {
  const trimmed = input.trim()
  if (!trimmed) throw new Error("empty input is not stored")
  const arr = ensureLoaded()
  const last = arr[arr.length - 1]
  if (last && last.input === trimmed) return last
  idCounter += 1
  const entry: HistoryEntry = { id: idCounter, input: trimmed, at: Date.now(), sessionId: opts?.sessionId, exit: opts?.exit }
  arr.push(entry)
  if (arr.length > MAX_ENTRIES) arr.splice(0, arr.length - MAX_ENTRIES)
  persist()
  notify()
  return entry
}

export function appendHistoryLine(entry: HistoryEntry) {
  const path = defaultPath()
  try {
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, JSON.stringify(entry) + "\n", "utf8")
  } catch {
    /* ignore */
  }
}

export function listHistory(filter?: { sessionId?: string; query?: string; limit?: number }): HistoryEntry[] {
  const arr = ensureLoaded()
  let out = arr
  if (filter?.sessionId) out = out.filter((e) => e.sessionId === filter.sessionId)
  if (filter?.query) {
    const q = filter.query.toLowerCase()
    out = out.filter((e) => e.input.toLowerCase().includes(q))
  }
  if (filter?.limit) out = out.slice(-filter.limit)
  return out
}

export function clearHistory(sessionId?: string) {
  if (sessionId) {
    cache = ensureLoaded().filter((e) => e.sessionId !== sessionId)
  } else {
    cache = []
  }
  persist()
  notify()
}

export function onHistoryChange(fn: () => void): () => void {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

export function setHistoryPath(path: string) {
  persistPath = path
  cache = null
}
