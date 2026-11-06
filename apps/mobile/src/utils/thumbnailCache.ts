/**
 * A key for a route picture: the same route, territory and map theme always give the same key, so a
 * card scrolled away and back (or shown on two screens) reuses its bitmap instead of rendering it again.
 * Coordinates are rounded to about a metre, finer than the picture can show.
 */
export function thumbnailKey(
  route: ReadonlyArray<readonly [number, number]>,
  territory: ReadonlyArray<readonly [number, number]> | null | undefined,
  isDark: boolean
): string {
  const encode = (pts: ReadonlyArray<readonly [number, number]>) =>
    pts.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(';');
  return `${isDark ? 'd' : 'l'}|${encode(route)}|${territory ? encode(territory) : ''}`;
}

/** A small least-recently-used map from key to the picture's file uri. */
export function createThumbnailCache(maxEntries: number) {
  const entries = new Map<string, string>();
  return {
    get(key: string): string | undefined {
      const uri = entries.get(key);
      if (uri === undefined) return undefined;
      entries.delete(key);
      entries.set(key, uri);
      return uri;
    },
    set(key: string, uri: string): void {
      entries.delete(key);
      if (entries.size >= maxEntries) entries.delete(entries.keys().next().value as string);
      entries.set(key, uri);
    },
  };
}
