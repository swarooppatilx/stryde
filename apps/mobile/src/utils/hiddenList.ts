export interface HiddenEntry {
  address: string;
  kind: 'blocked' | 'muted';
}

/** Everyone the athlete has hidden, blocked ones first; someone both blocked and muted shows once, as blocked. */
export function hiddenList(blocked: readonly string[], muted: readonly string[]): HiddenEntry[] {
  const blockedSet = new Set(blocked);
  return [
    ...blocked.map((address) => ({ address, kind: 'blocked' as const })),
    ...muted
      .filter((address) => !blockedSet.has(address))
      .map((address) => ({ address, kind: 'muted' as const })),
  ];
}
