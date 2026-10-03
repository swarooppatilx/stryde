export type SearchScope = 'all' | 'people' | 'activities' | 'clubs' | 'events';

export const SEARCH_SCOPES: readonly { value: SearchScope; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'people', label: 'People' },
  { value: 'activities', label: 'Activities' },
  { value: 'clubs', label: 'Clubs' },
  { value: 'events', label: 'Events' },
];

/** What a result list can hold: everything but 'all' is also a scope of its own. */
export type SearchKind = Exclude<SearchScope, 'all'>;

/** Whether results of `kind` are listed under the chosen scope. */
export function scopeShows(scope: SearchScope, kind: SearchKind): boolean {
  return scope === 'all' || scope === kind;
}

/** Under All a kind is a short preview of its best matches; under its own scope it lists them all. */
export function resultLimit(scope: SearchScope, preview: number): number {
  return scope === 'all' ? preview : Number.POSITIVE_INFINITY;
}
