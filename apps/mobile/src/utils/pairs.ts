/** Consecutive pairs of a list: [a, b], [b, c], ... */
export function pairs<T>(items: readonly T[]): Array<[T, T]> {
  const out: Array<[T, T]> = [];
  for (let i = 1; i < items.length; i++) {
    out.push([items[i - 1] as T, items[i] as T]);
  }
  return out;
}
