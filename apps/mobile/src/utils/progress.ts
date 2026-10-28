/** Share of `goal` reached by `value`, clamped to 0..1 for a progress bar. */
export function progressFraction(value: number, goal: number): number {
  if (goal <= 0 || value <= 0) return 0;
  return Math.min(1, value / goal);
}
