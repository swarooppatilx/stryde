import type { Activity } from '@/types';
import { parsePolyline } from './format';
import { haversineDistance } from './geo';
import { ordinal } from './plural';

/** Starts this close count as the same place. */
const SAME_START_M = 250;
/** Distances this close count as the same effort. */
const SAME_DISTANCE_RATIO = 0.15;

/**
 * How a recorded activity ranks (by time, 1 = quickest) among the athlete's own recorded
 * activities of the same sport that start in the same place and cover about the same distance.
 * Null when it has no route, was typed in by hand, or has no similar activity to compare with.
 */
export function similarRuns(
  activity: Activity,
  all: readonly Activity[]
): { count: number; rank: number } | null {
  if (activity.isManual) return null;
  const start = parsePolyline(activity.polyline ?? '')[0];
  if (!start || activity.distance <= 0) return null;

  const group = all.filter((other) => {
    if (other.isManual || other.activityType !== activity.activityType) return false;
    if (Math.abs(other.distance - activity.distance) / activity.distance > SAME_DISTANCE_RATIO) {
      return false;
    }
    const otherStart = parsePolyline(other.polyline ?? '')[0];
    return (
      !!otherStart &&
      haversineDistance(start[1], start[0], otherStart[1], otherStart[0]) <= SAME_START_M
    );
  });
  if (!group.some((other) => other.id === activity.id)) group.push(activity);
  if (group.length < 2) return null;

  const rank = group.filter((other) => other.duration < activity.duration).length + 1;
  return { count: group.length, rank };
}

/** One line for the activity page: "Your fastest of 4 similar runs", "2nd fastest of 4 similar runs". */
export function similarRunsText({ count, rank }: { count: number; rank: number }): string {
  return rank === 1
    ? `Your fastest of ${count} similar runs`
    : `${ordinal(rank)} fastest of ${count} similar runs`;
}
