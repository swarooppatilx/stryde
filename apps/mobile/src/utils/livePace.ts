import type { Split } from '@/types';
import { rampColor } from './paceGradient';

/**
 * Colour stops for the live trail, one per finished split: slower splits at the start of `colors`,
 * faster at the end. The unfinished stretch keeps the colour of the latest split. Null until two
 * splits differ in pace, when a single colour says as much.
 */
export function livePaceStops(
  splits: readonly Split[],
  totalMeters: number,
  colors: readonly string[]
): Array<{ progress: number; color: string }> | null {
  const done = splits.filter((s) => s.distance > 0 && s.movingTime > 0);
  if (done.length < 2 || totalMeters <= 0) return null;
  const speeds = done.map((s) => s.distance / s.movingTime);
  const slow = Math.min(...speeds);
  const fast = Math.max(...speeds);
  if (fast <= slow) return null;

  const stops: Array<{ progress: number; color: string }> = [];
  let covered = 0;
  done.forEach((split, i) => {
    stops.push({
      progress: Math.min(1, covered / totalMeters),
      color: rampColor(((speeds[i] as number) - slow) / (fast - slow), colors),
    });
    covered += split.distance;
  });
  const last = stops.at(-1);
  if (!last || last.progress >= 1) return null;
  stops.push({ progress: 1, color: last.color });
  return stops;
}
