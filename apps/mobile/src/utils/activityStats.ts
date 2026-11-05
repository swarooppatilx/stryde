import { GPS_DISTANCE_SPORTS } from '@/constants/activity';
import type { ActivityStream, ActivityType } from '@/types';
import { cadenceSummary } from './cadence';
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatPaceOrSpeed,
  showsSpeed,
  type UnitSystem,
} from './format';

export interface ActivityStat {
  label: string;
  value: string;
}

interface StatSource {
  activityType: ActivityType;
  distance: number;
  duration: number;
  elevationGain?: number | null;
  /** The highest point of the route in metres above sea level, when the elevations are known. */
  maxElevation?: number | null;
  /** Start to finish in ms, pauses included. Pass it where there is room to show both times. */
  elapsed?: number;
  heartRate?: { avg: number; max: number } | null;
  /** Estimated kcal; left out when there is no honest estimate. */
  calories?: number | null;
  stream?: ActivityStream;
}

/** Below this the two times read the same, so one "Time" is clearer than two. */
const MIN_PAUSED_MS = 10_000;

/** Figures an activity is summed up by, in scan order; those that do not apply (no distance for yoga) are omitted, not zero. */
export function activityStats(activity: StatSource, unitSystem: UnitSystem): ActivityStat[] {
  const { activityType, distance, duration, elevationGain, elapsed, calories } = activity;
  const stats: ActivityStat[] = [];
  if (distance > 0) stats.push({ label: 'Distance', value: formatDistance(distance, unitSystem) });
  if (GPS_DISTANCE_SPORTS.has(activityType) && distance > 0 && duration > 0) {
    stats.push({
      label: showsSpeed(activityType) ? 'Speed' : 'Pace',
      value: formatPaceOrSpeed(activityType, distance, duration, unitSystem),
    });
  }
  if (duration > 0) {
    const paused = elapsed !== undefined && elapsed - duration >= MIN_PAUSED_MS;
    stats.push({ label: paused ? 'Moving time' : 'Time', value: formatDuration(duration) });
    if (paused) stats.push({ label: 'Elapsed time', value: formatDuration(elapsed) });
  }
  // Average then peak; a still-pedometer activity shows nothing.
  if (activity.stream?.cadence && duration > 0) {
    const { avg, max } = cadenceSummary(activity.stream.cadence);
    if (max > 0) stats.push({ label: 'Cadence', value: `${avg}–${max} spm` });
  }
  if (activity.heartRate && activity.heartRate.avg > 0) {
    const { avg, max } = activity.heartRate;
    stats.push({ label: 'Heart rate', value: `${avg}–${max} bpm` });
  }
  if (elevationGain != null && elevationGain > 0) {
    stats.push({ label: 'Elevation', value: formatElevation(elevationGain, unitSystem) });
  }
  if (activity.maxElevation != null) {
    stats.push({
      label: 'Max elevation',
      value: formatElevation(activity.maxElevation, unitSystem),
    });
  }
  if (calories != null && calories > 0) {
    stats.push({ label: 'Calories', value: `${calories} kcal` });
  }
  return stats;
}

export type SportFamily = 'foot' | 'cycle' | 'water' | 'other';

const FOOT_SPORTS: ReadonlySet<ActivityType> = new Set<ActivityType>(['run', 'walk', 'hike']);
const WATER_SPORTS: ReadonlySet<ActivityType> = new Set<ActivityType>(['swim', 'row']);

export function sportFamily(activityType: ActivityType): SportFamily {
  if (FOOT_SPORTS.has(activityType)) return 'foot';
  if (activityType === 'ride') return 'cycle';
  if (WATER_SPORTS.has(activityType)) return 'water';
  return 'other';
}

/** Tile labels each family shows, in order. Heart rate and calories follow for every family, when measured. */
const FAMILY_LABELS: Record<SportFamily, readonly string[]> = {
  foot: ['Distance', 'Pace', 'Moving time', 'Time', 'Elapsed time', 'Elevation', 'Cadence'],
  cycle: ['Distance', 'Speed', 'Moving time', 'Time', 'Elapsed time', 'Elevation'],
  water: ['Distance', 'Moving time', 'Time', 'Elapsed time'],
  other: ['Distance', 'Moving time', 'Time', 'Elapsed time'],
};
const MEASURED_LABELS = ['Heart rate', 'Calories'] as const;

/** The tiles for the detail grid: the figures that matter for the sport's family, then heart rate and calories if there are any. */
export function sportStatSet(activity: StatSource, unitSystem: UnitSystem): ActivityStat[] {
  const order = [...FAMILY_LABELS[sportFamily(activity.activityType)], ...MEASURED_LABELS];
  return activityStats(activity, unitSystem)
    .filter((stat) => order.includes(stat.label))
    .sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
}
