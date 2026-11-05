import { GPS_DISTANCE_SPORTS } from '@/constants/activity';
import type { ActivityType } from '@/types';

/** A GPS sport that moved less than this is a mis-tap or a lost signal, not an activity. */
export const MIN_GPS_DISTANCE_M = 10;

export function isTooShort(activityType: ActivityType, distanceMeters: number): boolean {
  return GPS_DISTANCE_SPORTS.has(activityType) && distanceMeters < MIN_GPS_DISTANCE_M;
}
