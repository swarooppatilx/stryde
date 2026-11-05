import type { Lap } from '@/types';
import { formatDistance, formatDuration, type UnitSystem } from '@/utils/format';

export interface LapMark {
  /** Distance covered when lap was pressed, in meters. */
  distance: number;
  /** Moving time at that moment, in ms. */
  duration: number;
}

/**
 * The laps of a finished run: it is cut at each mark, and the stretch after the last one is the final
 * lap. A mark identical to the one before it (a double tap) adds nothing, and neither does a final
 * stretch with no distance or time. No marks means no laps.
 */
export function lapsFromMarks(marks: readonly LapMark[], end: LapMark): Lap[] {
  if (marks.length === 0) return [];
  const laps: Lap[] = [];
  let previous: LapMark = { distance: 0, duration: 0 };

  for (const mark of [...marks, end]) {
    const distance = mark.distance - previous.distance;
    const duration = mark.duration - previous.duration;
    if (distance > 0 || duration > 0) {
      laps.push({ index: laps.length + 1, distance, duration });
      previous = mark;
    }
  }
  return laps;
}

/** The lap the newest mark has just closed, or null before any lap was marked. */
export function latestLap(marks: readonly LapMark[]): Lap | null {
  const newest = marks.at(-1);
  if (!newest) return null;
  return lapsFromMarks(marks, newest).at(-1) ?? null;
}

/** One line for a lap that has just been completed: "Lap 3 · 5m 12s · 1.00km". */
export function lapSummary(lap: Lap, unitSystem: UnitSystem): string {
  return `Lap ${lap.index} · ${formatDuration(lap.duration)} · ${formatDistance(lap.distance, unitSystem)}`;
}
