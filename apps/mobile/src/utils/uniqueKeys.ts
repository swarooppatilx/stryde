/**
 * One React key per item that stays with the item, not its position: the value itself, and for a
 * repeat the value plus how many times it has been seen, so removing a neighbour remounts nothing.
 */
export function uniqueKeys(values: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return values.map((value) => {
    const count = (seen.get(value) ?? 0) + 1;
    seen.set(value, count);
    return count === 1 ? value : `${value}#${count}`;
  });
}
