import { MAX_SPEED_KMH } from '@/constants/activity';
import type { ActivityType, BestEffort, Location } from '@/types';
import { haversineDistance } from './geo';
import { STOP_GAP_MS, STOP_SPEED_MS } from './splits';

const BEST_EFFORT_DISTANCES = [400, 1000, 1609, 5000, 10_000, 21_097, 42_195] as const;

/** A sparse track can span a nominal distance without enough fixes to time it reliably. */
const MIN_FIXES_PER_KILOMETER = 8;

/** Old local records also pass through this guard before they can become a personal record. */
export function isPlausibleBestEffort(
  effort: BestEffort,
  activityDistance: number,
  activityType: ActivityType
): boolean {
  if (!BEST_EFFORT_DISTANCES.includes(effort.distance as (typeof BEST_EFFORT_DISTANCES)[number])) {
    return false;
  }
  if (
    !Number.isFinite(activityDistance) ||
    !Number.isFinite(effort.movingTime) ||
    effort.distance > activityDistance ||
    effort.movingTime <= 0
  ) {
    return false;
  }

  // Moving time is milliseconds. This rejects stale GPS spikes that made a short walk look like a
  // fast kilometre, while still using each sport's existing maximum-speed ceiling.
  const minimumTime = (effort.distance * 3600) / MAX_SPEED_KMH[activityType];
  return effort.movingTime >= minimumTime;
}

/** Cumulative distance and moving time at each fix; a stop adds distance but no time. */
function movingProfile(locations: readonly Location[]): { distance: number[]; time: number[] } {
  const distance = [0];
  const time = [0];
  for (let i = 1; i < locations.length; i++) {
    const from = locations[i - 1] as Location;
    const to = locations[i] as Location;
    const meters = haversineDistance(from.latitude, from.longitude, to.latitude, to.longitude);
    const elapsed = Math.max(0, to.timestamp - from.timestamp);
    const stopped = elapsed > STOP_GAP_MS && meters / (elapsed / 1000) < STOP_SPEED_MS;
    distance.push((distance[i - 1] as number) + meters);
    time.push((time[i - 1] as number) + (stopped ? 0 : elapsed));
  }
  return { distance, time };
}

/**
 * The fastest continuous stretch of each standard distance the run covered, wherever it
 * started (not just at kilometre marks), by moving time. Distances the run never reached
 * are left out.
 */
export function computeBestEfforts(
  locations: readonly Location[],
  activityDistance: number,
  activityType: ActivityType
): BestEffort[] {
  if (locations.length < 2) return [];
  const { distance, time } = movingProfile(locations);
  const total = distance[distance.length - 1] as number;
  if (!Number.isFinite(activityDistance) || activityDistance <= 0) return [];
  const efforts: BestEffort[] = [];

  for (const target of BEST_EFFORT_DISTANCES) {
    if (total < target || activityDistance < target) break;
    let best = Number.POSITIVE_INFINITY;
    let bestFixCount = 0;
    let start = 0;
    for (let end = 1; end < distance.length; end++) {
      const endDistance = distance[end] as number;
      if (endDistance < target) continue;
      const wanted = endDistance - target;
      // Both pointers only move forward, so the whole scan is linear.
      while ((distance[start + 1] as number) <= wanted) start++;
      const span = (distance[start + 1] as number) - (distance[start] as number);
      const share = span > 0 ? (wanted - (distance[start] as number)) / span : 0;
      const startTime =
        (time[start] as number) + share * ((time[start + 1] as number) - (time[start] as number));
      const candidate = (time[end] as number) - startTime;
      if (candidate < best) {
        best = candidate;
        bestFixCount = end - start;
      }
    }
    const effort = { distance: target, movingTime: best };
    const minimumFixes = Math.ceil((target / 1000) * MIN_FIXES_PER_KILOMETER);
    if (
      Number.isFinite(best) &&
      bestFixCount >= minimumFixes &&
      isPlausibleBestEffort(effort, activityDistance, activityType)
    ) {
      efforts.push(effort);
    }
  }
  return efforts;
}
