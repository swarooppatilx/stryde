/** Whether data loaded at `loadedAt` (ms, or null for never) is older than `ttlMs` at `now`. */
export function isStale(loadedAt: number | null, now: number, ttlMs: number): boolean {
  if (loadedAt === null) return true;
  const age = now - loadedAt;
  return age < 0 || age >= ttlMs;
}
