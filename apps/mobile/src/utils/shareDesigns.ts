import type { ActivityType } from '@/types';
import {
  formatDistance,
  formatDurationLong,
  formatElevation,
  formatPaceOrSpeed,
  METERS_PER_MILE,
  showsSpeed,
  type UnitSystem,
} from './format';

export const SHARE_DESIGNS = [
  'route',
  'stats',
  'big-route',
  'minimal',
  'receipt',
  'splits',
  'photo',
] as const;
export type ShareDesign = (typeof SHARE_DESIGNS)[number];

/** What a design is drawn on: transparent cards work as stickers, dark, light and photo cards fill the story. */
export type ShareBackground = 'transparent' | 'dark' | 'light' | 'photo';

export const SHARE_DESIGN_INFO: Record<
  ShareDesign,
  { label: string; background: ShareBackground }
> = {
  route: { label: 'Route', background: 'transparent' },
  stats: { label: 'Stats', background: 'dark' },
  'big-route': { label: 'Big route', background: 'transparent' },
  minimal: { label: 'Minimal', background: 'transparent' },
  receipt: { label: 'Receipt', background: 'light' },
  splits: { label: 'Splits', background: 'dark' },
  photo: { label: 'Photo', background: 'photo' },
};

export const SHARE_DESIGN_LABEL = Object.fromEntries(
  SHARE_DESIGNS.map((id) => [id, SHARE_DESIGN_INFO[id].label])
) as Record<ShareDesign, string>;

/** What an activity has that decides which designs make sense for it. */
export interface ShareContext {
  photoUri?: string;
  /** How many splits the recording has; the splits card compares them, so it needs at least two. */
  splitCount?: number;
}

/** The designs worth offering: each one that needs something (a photo, splits) is left out until the activity has it. */
export function availableShareDesigns({ photoUri, splitCount = 0 }: ShareContext): ShareDesign[] {
  return SHARE_DESIGNS.filter((id) => {
    if (id === 'photo') return !!photoUri;
    if (id === 'splits') return splitCount >= 2;
    return true;
  });
}

/** The chosen design while it is on offer, otherwise the first one. */
export function resolveShareDesign(
  selected: ShareDesign,
  available: readonly ShareDesign[]
): ShareDesign {
  return available.includes(selected) ? selected : (available[0] ?? 'route');
}

export function firstSharePhoto(images: readonly string[] | undefined): string | undefined {
  return images?.[0];
}

export interface ShareCardStat {
  label: string;
  value: string;
}

/** Distance, time and pace (speed for a ride) for the stat overlay; pace is left out when it cannot be worked out. */
export function shareCardStats(
  activity: { activityType: ActivityType; distance: number; duration: number },
  unitSystem: UnitSystem
): ShareCardStat[] {
  const { activityType, distance, duration } = activity;
  const stats: ShareCardStat[] = [];
  if (distance > 0) stats.push({ label: 'Distance', value: formatDistance(distance, unitSystem) });
  if (duration > 0) stats.push({ label: 'Time', value: formatDurationLong(duration) });
  if (distance > 0 && duration > 0) {
    stats.push({
      label: showsSpeed(activityType) ? 'Speed' : 'Pace',
      value: formatPaceOrSpeed(activityType, distance, duration, unitSystem),
    });
  }
  return stats;
}

/** Climb, heart rate and calories for the cards that have room for more than the basic three; each is left out when the activity has no figure. */
export function shareExtraStats(
  activity: {
    distance: number;
    elevationGain?: number;
    heartRate?: { avg: number; max: number };
    caloriesBurned?: number;
  },
  unitSystem: UnitSystem
): ShareCardStat[] {
  const stats: ShareCardStat[] = [];
  if (activity.elevationGain && activity.elevationGain > 0) {
    stats.push({ label: 'Elevation', value: formatElevation(activity.elevationGain, unitSystem) });
  }
  if (activity.heartRate && activity.heartRate.avg > 0) {
    stats.push({ label: 'Heart rate', value: `${Math.round(activity.heartRate.avg)} bpm` });
  }
  if (activity.caloriesBurned && activity.caloriesBurned > 0) {
    stats.push({ label: 'Calories', value: `${Math.round(activity.caloriesBurned)} kcal` });
  }
  return stats;
}

export interface ShareSplitBar {
  label: string;
  pace: string;
  /** 1 for the fastest split, shorter for slower ones, so the bars read as a pace chart. */
  ratio: number;
}

/** Splits on the card: more than this and the bars turn to hairlines (a marathon shows its first stretch). */
const MAX_SPLIT_BARS = 12;

/** One bar per split with its pace; a short last split is labelled by the distance it covered. */
export function shareSplitBars(
  splits: readonly { index: number; distance: number; movingTime: number }[],
  activityType: ActivityType,
  unitSystem: UnitSystem
): ShareSplitBar[] {
  const usable = splits.filter((s) => s.distance > 0 && s.movingTime > 0).slice(0, MAX_SPLIT_BARS);
  if (usable.length === 0) return [];
  // Pace as ms per metre: smaller is faster.
  const speed = (s: { distance: number; movingTime: number }) => s.distance / s.movingTime;
  const best = Math.max(...usable.map(speed));
  const fullLength = Math.max(...usable.map((s) => s.distance));
  const unit = unitSystem === 'imperial' ? METERS_PER_MILE : 1000;
  return usable.map((s) => ({
    label:
      s.distance < fullLength * 0.95
        ? String(Number((s.distance / unit).toFixed(2)))
        : String(s.index),
    pace: formatPaceOrSpeed(activityType, s.distance, s.movingTime, unitSystem),
    ratio: speed(s) / best,
  }));
}
