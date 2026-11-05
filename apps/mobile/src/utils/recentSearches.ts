export const MAX_RECENT_SEARCHES = 50;

export interface RecentSearch {
  kind: 'user' | 'activity';
  id: string;
  label: string;
}

/** `list` with `entry` first; a repeat moves to the front, and the oldest fall off the end. */
export function rememberSearch(list: readonly RecentSearch[], entry: RecentSearch): RecentSearch[] {
  const others = list.filter((r) => !(r.kind === entry.kind && r.id === entry.id));
  return [entry, ...others].slice(0, MAX_RECENT_SEARCHES);
}
