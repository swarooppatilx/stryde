export interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export function createTtlCache<T>(
  ttlMs: number,
  max = 500
): { get(key: string): T | undefined; set(key: string, value: T): void; clear(): void } {
  const cache = new Map<string, CacheEntry<T>>();

  function get(key: string): T | undefined {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > ttlMs) {
      cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function set(key: string, value: T): void {
    if (cache.size >= max) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }
    cache.set(key, { value, timestamp: Date.now() });
  }

  function clear(): void {
    cache.clear();
  }

  return { get, set, clear };
}
