export type UsageKind = "input" | "output" | "cache_read" | "cache_write" | "reasoning"

export interface UsageRecord {
  sessionId: string
  model: string
  provider: string
  kind: UsageKind
  tokens: number
  cost: number
  at: number
}

export interface UsageSummary {
  totalTokens: number
  totalCost: number
  byModel: Record<string, { tokens: number; cost: number }>
  byProvider: Record<string, { tokens: number; cost: number }>
  byKind: Record<UsageKind, number>
  byDay: Record<string, { tokens: number; cost: number }>
  records: number
}

const store: UsageRecord[] = []
const listeners = new Set<(rec: UsageRecord) => void>()

const EMPTY: UsageSummary = {
  totalTokens: 0,
  totalCost: 0,
  byModel: {},
  byProvider: {},
  byKind: { input: 0, output: 0, cache_read: 0, cache_write: 0, reasoning: 0 },
  byDay: {},
  records: 0,
}

export function recordUsage(rec: Omit<UsageRecord, "at"> & { at?: number }) {
  const full: UsageRecord = { ...rec, at: rec.at ?? Date.now() }
  store.push(full)
  if (store.length > 50_000) store.splice(0, store.length - 50_000)
  for (const l of listeners) {
    try {
      l(full)
    } catch {
      /* ignore listener errors */
    }
  }
  return full
}

export function onUsage(fn: (rec: UsageRecord) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function listUsage(filter?: {
  sessionId?: string
  from?: number
  to?: number
}): UsageRecord[] {
  return store.filter((r) => {
    if (filter?.sessionId && r.sessionId !== filter.sessionId) return false
    if (filter?.from && r.at < filter.from) return false
    if (filter?.to && r.at > filter.to) return false
    return true
  })
}

export function summarizeUsage(filter?: {
  sessionId?: string
  from?: number
  to?: number
}): UsageSummary {
  const out: UsageSummary = {
    ...EMPTY,
    byModel: {},
    byProvider: {},
    byKind: { input: 0, output: 0, cache_read: 0, cache_write: 0, reasoning: 0 },
    byDay: {},
  }
  for (const r of listUsage(filter)) {
    out.totalTokens += r.tokens
    out.totalCost += r.cost
    out.records += 1
    out.byKind[r.kind] += r.tokens
    const m = (out.byModel[r.model] ??= { tokens: 0, cost: 0 })
    m.tokens += r.tokens
    m.cost += r.cost
    const p = (out.byProvider[r.provider] ??= { tokens: 0, cost: 0 })
    p.tokens += r.tokens
    p.cost += r.cost
    const day = new Date(r.at).toISOString().slice(0, 10)
    const d = (out.byDay[day] ??= { tokens: 0, cost: 0 })
    d.tokens += r.tokens
    d.cost += r.cost
  }
  return out
}

export function resetUsage() {
  store.length = 0
}

export function estimateCost(model: string, kind: UsageKind, tokens: number): number {
  const table: Record<string, number> = {
    "gpt-4o": 0.000_005,
    "gpt-4o-mini": 0.000_000_15,
    "claude-sonnet-4": 0.000_003,
    "claude-opus-4": 0.000_015,
  }
  const rate = table[model] ?? 0.000_001
  return Math.round(rate * tokens * 1_000_000) / 1_000_000
}
