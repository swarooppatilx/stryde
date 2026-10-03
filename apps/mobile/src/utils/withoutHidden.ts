/** `items` minus those whose author is in `hidden` (lower-case addresses). */
export function withoutHidden<T>(
  items: T[],
  authorOf: (item: T) => string,
  hidden: ReadonlySet<string>
): T[] {
  if (hidden.size === 0) return items;
  return items.filter((item) => !hidden.has(authorOf(item).toLowerCase()));
}
