import { GPS_DISTANCE_SPORTS } from '@/constants/activity';
import { CELEBRATIONS, SHORT_ACTIVITY_LINE } from '@/constants/copy';
import type { ActivityType } from '@/types';

/** Under a kilometre for a GPS sport, or under five minutes for the rest, is short. */
const SHORT_DISTANCE_M = 1000;
const SHORT_TIME_MS = 5 * 60_000;

export function isShortActivity(activity: {
  distance: number;
  duration: number;
  activityType: ActivityType;
}): boolean {
  return GPS_DISTANCE_SPORTS.has(activity.activityType)
    ? activity.distance < SHORT_DISTANCE_M
    : activity.duration < SHORT_TIME_MS;
}

/** The line shown under a saved activity: a kind word for a short one, else one that changes as they save more. */
export function celebrationFor({
  activityCount,
  short,
}: {
  activityCount: number;
  short: boolean;
}): string {
  if (short) return SHORT_ACTIVITY_LINE;
  const index = Math.max(0, activityCount - 1) % CELEBRATIONS.length;
  return CELEBRATIONS[index] as string;
}
