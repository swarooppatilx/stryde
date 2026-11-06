/**
 * A small in-memory cache: entries expire after `ttlMs` and, once there are `maxEntries`, the oldest
 * goes first. Meant for answers worth reusing for a few minutes (a routed leg), not for anything
 * that must survive a restart. `now` is injectable so tests can move the clock.
 */
export function createTtlCache<V>(ttlMs: number, maxEntries: number, now: () => number = Date.now) {
  const entries = new Map<string, { at: number; value: V }>();

  return {
    get(key: string): V | undefined {
      const hit = entries.get(key);
      if (!hit) return undefined;
      if (now() - hit.at >= ttlMs) {
        entries.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key: string, value: V): void {
      // Re-adding a key moves it to the back, so a refreshed answer is the last to be evicted.
      entries.delete(key);
      if (entries.size >= maxEntries) entries.delete(entries.keys().next().value as string);
      entries.set(key, { at: now(), value });
    },
  };
}
