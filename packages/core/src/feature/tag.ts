export interface Tag {
  id: string
  name: string
  color: string
  emoji?: string
}

export interface TaggedSession {
  sessionId: string
  tagIds: string[]
  pinned: boolean
  snoozedUntil?: number
  updatedAt: number
}

const PALETTE = [
  "#6dd3ff",
  "#a280ff",
  "#ff80b5",
  "#ffd166",
  "#7ee787",
  "#ff9b6a",
  "#9aa0a6",
]

function rid() {
  return Math.random().toString(36).slice(2, 10)
}

const tags = new Map<string, Tag>()
const tagged = new Map<string, TaggedSession>()
const listeners = new Set<() => void>()

export function listTags(): Tag[] {
  return Array.from(tags.values())
}

export function createTag(input: { name: string; color?: string; emoji?: string }): Tag {
  const color = input.color ?? PALETTE[tags.size % PALETTE.length]
  const tag: Tag = { id: rid(), name: input.name, color, emoji: input.emoji }
  tags.set(tag.id, tag)
  emit()
  return tag
}

export function removeTag(id: string) {
  tags.delete(id)
  for (const ts of tagged.values()) {
    ts.tagIds = ts.tagIds.filter((t) => t !== id)
  }
  emit()
}

export function getTaggedSession(sessionId: string): TaggedSession {
  let ts = tagged.get(sessionId)
  if (!ts) {
    ts = { sessionId, tagIds: [], pinned: false, updatedAt: Date.now() }
    tagged.set(sessionId, ts)
  }
  return ts
}

export function setTags(sessionId: string, tagIds: string[]) {
  const ts = getTaggedSession(sessionId)
  ts.tagIds = Array.from(new Set(tagIds))
  ts.updatedAt = Date.now()
  emit()
}

export function addTag(sessionId: string, tagId: string) {
  const ts = getTaggedSession(sessionId)
  if (!ts.tagIds.includes(tagId)) {
    ts.tagIds.push(tagId)
    ts.updatedAt = Date.now()
    emit()
  }
}

export function removeTagFromSession(sessionId: string, tagId: string) {
  const ts = getTaggedSession(sessionId)
  ts.tagIds = ts.tagIds.filter((t) => t !== tagId)
  ts.updatedAt = Date.now()
  emit()
}

export function setPinned(sessionId: string, pinned: boolean) {
  const ts = getTaggedSession(sessionId)
  ts.pinned = pinned
  ts.updatedAt = Date.now()
  emit()
}

export function setSnoozed(sessionId: string, until: number | undefined) {
  const ts = getTaggedSession(sessionId)
  ts.snoozedUntil = until
  ts.updatedAt = Date.now()
  emit()
}

export function searchSessions(
  query: string,
  all: Array<{ id: string; title?: string }>,
): Array<{ id: string; title?: string; tags: string[]; pinned: boolean; score: number }> {
  const q = query.trim().toLowerCase()
  if (!q) {
    return all.map((s) => {
      const ts = getTaggedSession(s.id)
      return { ...s, tags: ts.tagIds, pinned: ts.pinned, score: 0 }
    })
  }
  const out: Array<{ id: string; title?: string; tags: string[]; pinned: boolean; score: number }> = []
  for (const s of all) {
    let score = 0
    const title = (s.title ?? "").toLowerCase()
    if (title.includes(q)) score += 10
    if (s.id.includes(q)) score += 5
    const ts = getTaggedSession(s.id)
    for (const tid of ts.tagIds) {
      const tag = tags.get(tid)
      if (tag && tag.name.toLowerCase().includes(q)) score += 4
    }
    if (ts.pinned) score += 1
    if (score > 0) out.push({ ...s, tags: ts.tagIds, pinned: ts.pinned, score })
  }
  return out.sort((a, b) => b.score - a.score)
}

export function onTagsChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit() {
  for (const l of listeners) {
    try {
      l()
    } catch {
      /* ignore */
    }
  }
}
