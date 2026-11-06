/** `Array.sort` comparator for text, numbers and bigints (a plain `a - b` does not work for bigint or text). */
export function compare<T extends string | number | bigint>(a: T, b: T): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
