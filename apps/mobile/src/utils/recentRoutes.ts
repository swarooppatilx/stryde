import type { Activity } from '@/types';
import { MIN_GPS_DISTANCE_M } from './minimumRun';

/** The first `limit` activities that have a line worth drawing: two or more points, and a real distance. */
export function recentRoutes<T extends Pick<Activity, 'polyline' | 'distance'>>(
  activities: readonly T[],
  limit: number
): T[] {
  return activities
    .filter(
      (a) =>
        (a.polyline ?? '').split(';').filter((point) => point.includes(',')).length >= 2 &&
        a.distance >= MIN_GPS_DISTANCE_M
    )
    .slice(0, limit);
}
