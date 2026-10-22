/** How long a finger rests on a chart before dragging scrubs it, so quicker swipes still page and scroll. */
export const SCRUB_HOLD_MS = 200;

/**
 * The index of the point a touch is over, for a chart whose points sit at `times` (seconds,
 * ascending) across `width` with `pad` either side. Null when there is no chart to point at.
 */
export function indexAtX(
  x: number,
  width: number,
  pad: number,
  times: readonly number[]
): number | null {
  const last = times.at(-1) ?? 0;
  const inner = width - pad * 2;
  if (inner <= 0 || times.length < 2 || last <= 0) return null;
  const at = (Math.min(Math.max(x - pad, 0), inner) / inner) * last;
  let best = 0;
  for (let i = 1; i < times.length; i++) {
    if (Math.abs((times[i] as number) - at) < Math.abs((times[best] as number) - at)) best = i;
  }
  return best;
}

/** The index of the value in `values` (ascending) closest to `target`; null for an empty list. */
export function nearestIndex(values: readonly number[], target: number): number | null {
  if (values.length === 0) return null;
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (Math.abs((values[i] as number) - target) < Math.abs((values[best] as number) - target)) {
      best = i;
    }
  }
  return best;
}
