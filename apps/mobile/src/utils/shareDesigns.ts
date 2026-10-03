import type { ActivityType } from '@/types';
import {
  formatDistance,
  formatDurationLong,
  formatPaceOrSpeed,
  showsSpeed,
  type UnitSystem,
} from './format';

export const SHARE_DESIGNS = ['route', 'stats', 'photo'] as const;
export type ShareDesign = (typeof SHARE_DESIGNS)[number];

export const SHARE_DESIGN_LABEL: Record<ShareDesign, string> = {
  route: 'Route',
  stats: 'Stats',
  photo: 'Photo',
};

/** The designs worth offering: the photo card needs a photo to build on. */
export function availableShareDesigns(photoUri: string | undefined): ShareDesign[] {
  return photoUri ? [...SHARE_DESIGNS] : ['route', 'stats'];
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
