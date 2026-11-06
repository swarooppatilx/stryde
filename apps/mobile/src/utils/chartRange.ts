/**
 * The vertical range a chart is drawn over: the data's own, but never narrower than `minSpan`.
 * Without a floor, a few metres of noise on a flat route are stretched to the full chart height.
 */
export function chartRange(values: readonly number[], minSpan = 0): { min: number; max: number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min >= minSpan) return { min, max };
  const middle = (min + max) / 2;
  return { min: middle - minSpan / 2, max: middle + minSpan / 2 };
}
