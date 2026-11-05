import type { ActivityType, Lap, Split } from '@/types';
import {
  formatDuration,
  formatPaceOrSpeed,
  METERS_PER_MILE,
  showsSpeed,
  type UnitSystem,
} from '@/utils/format';

interface Stretch {
  distance: number;
  /** Moving time in ms. */
  duration: number;
}

export interface Versus {
  text: string;
  /** Quicker than the run's average. */
  faster: boolean;
}

export interface StretchRow {
  key: string;
  label: string;
  time: string;
  /** Pace for foot sports, speed for rides. */
  pace: string;
  versus: Versus | null;
  /** The lap still in progress. */
  running: boolean;
}

const perUnit = (meters: number, unitSystem: UnitSystem) =>
  unitSystem === 'imperial' ? meters / METERS_PER_MILE : meters / 1000;

const secondsPerUnit = (s: Stretch, unitSystem: UnitSystem) =>
  s.duration / 1000 / perUnit(s.distance, unitSystem);

const kmhOrMph = (s: Stretch, unitSystem: UnitSystem) =>
  perUnit(s.distance, unitSystem) / (s.duration / 3_600_000);

function minutesSeconds(seconds: number): string {
  const whole = Math.round(Math.abs(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** How a stretch compares with the run's average: seconds per unit for pace sports, speed for rides. */
export function versusAverage(
  activityType: ActivityType,
  stretch: Stretch,
  average: Stretch,
  unitSystem: UnitSystem
): Versus | null {
  const usable = (s: Stretch) => s.distance > 0 && s.duration > 0;
  if (!usable(stretch) || !usable(average)) return null;

  if (showsSpeed(activityType)) {
    const diff = kmhOrMph(stretch, unitSystem) - kmhOrMph(average, unitSystem);
    const unit = unitSystem === 'imperial' ? 'mph' : 'km/h';
    return {
      text: `${diff >= 0 ? '+' : '-'}${Math.abs(diff).toFixed(1)} ${unit}`,
      faster: diff > 0,
    };
  }
  const diff = secondsPerUnit(stretch, unitSystem) - secondsPerUnit(average, unitSystem);
  if (Math.round(Math.abs(diff)) === 0) return { text: '0:00', faster: false };
  return { text: `${diff < 0 ? '-' : '+'}${minutesSeconds(diff)}`, faster: diff < 0 };
}

function row(
  key: string,
  label: string,
  stretch: Stretch,
  activityType: ActivityType,
  average: Stretch,
  unitSystem: UnitSystem,
  running: boolean
): StretchRow {
  return {
    key,
    label,
    time: formatDuration(stretch.duration),
    pace: formatPaceOrSpeed(activityType, stretch.distance, stretch.duration, unitSystem),
    versus: versusAverage(activityType, stretch, average, unitSystem),
    running,
  };
}

/** Closed laps, then the one still running (left out until it has covered some ground). */
export function lapRows(
  laps: readonly Lap[],
  running: Stretch,
  activityType: ActivityType,
  average: Stretch,
  unitSystem: UnitSystem
): StretchRow[] {
  const rows = laps.map((lap) =>
    row(`lap-${lap.index}`, `Lap ${lap.index}`, lap, activityType, average, unitSystem, false)
  );
  if (running.distance > 0 || running.duration > 0) {
    const next = (laps.at(-1)?.index ?? 0) + 1;
    rows.push(row(`lap-${next}`, `Lap ${next}`, running, activityType, average, unitSystem, true));
  }
  return rows;
}

export function splitRows(
  splits: readonly Split[],
  activityType: ActivityType,
  average: Stretch,
  unitSystem: UnitSystem
): StretchRow[] {
  const unit = unitSystem === 'imperial' ? 'mi' : 'km';
  return splits.map((split) =>
    row(
      `split-${split.index}`,
      `${unit} ${split.index}`,
      { distance: split.distance, duration: split.movingTime },
      activityType,
      average,
      unitSystem,
      false
    )
  );
}
