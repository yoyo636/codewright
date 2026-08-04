export type SyncEndpoint = "web" | "desktop" | "tui" | "cli"

export interface SyncEnvelope {
  version: 1
  endpoint: SyncEndpoint
  deviceId: string
  emittedAt: number
  kind:
    | "session.upsert"
    | "session.delete"
    | "tag.upsert"
    | "tag.delete"
    | "template.upsert"
    | "template.delete"
    | "usage.append"
    | "ping"
    | "snapshot"
  payload: unknown
}

export interface SyncSnapshot {
  exportedAt: number
  endpoint: SyncEndpoint
  sessions: Array<{ id: string; title?: string; updatedAt: number; tagIds: string[]; pinned: boolean }>
  tags: Array<{ id: string; name: string; color: string; emoji?: string }>
  templates: Array<{ id: string; name: string; prompt: string; agent?: string; model?: string }>
}

const STORAGE_KEY = "codewright:device-id"
const listeners = new Set<(env: SyncEnvelope) => void>()
const remoteListeners = new Map<SyncEndpoint, Set<(env: SyncEnvelope) => void>>()

function getDeviceId(): string {
  if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) {
    try {
      const ls = (globalThis as any).localStorage
      const existing = ls.getItem(STORAGE_KEY)
      if (existing) return existing
      const newId = "dev-" + Math.random().toString(36).slice(2, 12)
      ls.setItem(STORAGE_KEY, newId)
      return newId
    } catch {
      /* ignore */
    }
  }
  return "dev-" + Math.random().toString(36).slice(2, 12)
}

export function deviceId(): string {
  return getDeviceId()
}

export function emit(env: Omit<SyncEnvelope, "version" | "deviceId" | "emittedAt">) {
  const full: SyncEnvelope = {
    version: 1,
    deviceId: getDeviceId(),
    emittedAt: Date.now(),
    ...env,
  }
  for (const l of listeners) {
    try {
      l(full)
    } catch {
      /* ignore */
    }
  }
  return full
}

export function subscribe(fn: (env: SyncEnvelope) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function subscribeRemote(endpoint: SyncEndpoint, fn: (env: SyncEnvelope) => void): () => void {
  let set = remoteListeners.get(endpoint)
  if (!set) {
    set = new Set()
    remoteListeners.set(endpoint, set)
  }
  set.add(fn)
  return () => set!.delete(fn)
}

export function ingest(env: SyncEnvelope) {
  if (env.version !== 1) return false
  if (env.deviceId === getDeviceId()) return false
  const set = remoteListeners.get(env.endpoint)
  if (set) {
    for (const l of set) {
      try {
        l(env)
      } catch {
        /* ignore */
      }
    }
  }
  return true
}

export function buildSnapshot(endpoint: SyncEndpoint, data: Omit<SyncSnapshot, "exportedAt" | "endpoint">): SyncEnvelope {
  return emit({
    endpoint,
    kind: "snapshot",
    payload: { ...data, endpoint, exportedAt: Date.now() } as SyncSnapshot,
  })
}

export function encodeSync(env: SyncEnvelope): string {
  return JSON.stringify(env)
}

export function decodeSync(s: string): SyncEnvelope | null {
  try {
    const v = JSON.parse(s) as SyncEnvelope
    if (v && v.version === 1) return v
    return null
  } catch {
    return null
  }
}
