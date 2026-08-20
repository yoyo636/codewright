export * as LRU from "./lru"

/**
 * Minimal bounded LRU cache. `Map` preserves insertion order, so recency is
 * tracked by re-inserting on access and evicting the oldest entry past capacity.
 */
export function make<K, V>(capacity: number) {
  const cache = new Map<K, V>()
  return {
    get(key: K): V | undefined {
      const value = cache.get(key)
      if (value === undefined) return undefined
      cache.delete(key)
      cache.set(key, value)
      return value
    },
    set(key: K, value: V): void {
      if (capacity < 1) return
      if (cache.has(key)) cache.delete(key)
      cache.set(key, value)
      if (cache.size > capacity) {
        const oldest = cache.keys().next().value
        if (oldest !== undefined) cache.delete(oldest)
      }
    },
    get size() {
      return cache.size
    },
    clear(): void {
      cache.clear()
    },
  }
}
