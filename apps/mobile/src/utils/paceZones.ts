import type { Activity, ActivityStream, ActivityType } from '@/types';
import { plausibleStreamSpeeds } from './activityStream';
import { isPlausibleBestEffort } from './bestEfforts';
import { showsSpeed } from './format';
import { HEART_RATE_ZONES, MAX_READING_GAP_S, type ZoneTime } from './heartRateZones';
import { STOP_SPEED_MS } from './splits';

/**
 * Where zones 2 to 5 begin, as a share of threshold speed (the pace an athlete could hold for about
 * an hour). Slower than 78% is recovery, above 102% is faster than threshold.
 */
export const PACE_ZONE_FLOORS = [0.78, 0.88, 0.95, 1.02] as const;

/** A 5 km effort is run a little faster than threshold; this scales its speed back to it. */
export const THRESHOLD_FROM_5K = 0.97;

/** Efforts older than this say little about current fitness. */
export const THRESHOLD_WINDOW_DAYS = 180;

const DAY_MS = 86_400_000;

function fastestSpeed(activities: readonly Activity[], distance: number): number | null {
  let best: number | null = null;
  for (const a of activities) {
    const effort = a.bestEfforts?.find(
      (e) => e.distance === distance && isPlausibleBestEffort(e, a.distance, a.activityType)
    );
    if (!effort) continue;
    const speed = distance / (effort.movingTime / 1000);
    if (best === null || speed > best) best = speed;
  }
  return best;
}

/**
 * Threshold speed (m/s) from the athlete's own recent recorded efforts in the same sport: the fastest
 * 10 km, else the fastest 5 km scaled down. Null when there is neither, or for sports shown in speed.
 */
export function thresholdSpeed(
  activities: readonly Activity[],
  activityType: ActivityType,
  now: number
): number | null {
  if (showsSpeed(activityType)) return null;
  const recent = activities.filter(
    (a) =>
      a.activityType === activityType &&
      !a.isManual &&
      !a.mocked &&
      new Date(a.createdAt).getTime() >= now - THRESHOLD_WINDOW_DAYS * DAY_MS
  );
  const tenK = fastestSpeed(recent, 10_000);
  if (tenK !== null) return tenK;
  const fiveK = fastestSpeed(recent, 5000);
  return fiveK === null ? null : fiveK * THRESHOLD_FROM_5K;
}

export function paceZoneOf(
  speed: number,
  threshold: number
): (typeof HEART_RATE_ZONES)[number]['id'] {
  const share = speed / threshold;
  let id: (typeof HEART_RATE_ZONES)[number]['id'] = 1;
  PACE_ZONE_FLOORS.forEach((floor, i) => {
    if (share >= floor) id = (i + 2) as typeof id;
  });
  return id;
}

/** Seconds moving in each pace zone; stops are left out. Empty when nothing moving can be measured. */
export function timeInPaceZones(
  stream: ActivityStream,
  activityType: ActivityType,
  threshold: number
): ZoneTime[] {
  if (!(threshold > 0) || stream.t.length < 2) return [];
  const speeds = plausibleStreamSpeeds(stream.speed, activityType);
  const seconds = HEART_RATE_ZONES.map(() => 0);
  for (let i = 0; i < stream.t.length; i++) {
    const speed = speeds[i] ?? 0;
    if (speed < STOP_SPEED_MS) continue;
    const t = stream.t[i] as number;
    const next = stream.t[i + 1];
    const gap = next === undefined ? t - (stream.t[i - 1] ?? 0) : next - t;
    if (!(gap > 0)) continue;
    const index = paceZoneOf(speed, threshold) - 1;
    seconds[index] = (seconds[index] as number) + Math.min(gap, MAX_READING_GAP_S);
  }
  const total = seconds.reduce((sum, v) => sum + v, 0);
  if (total === 0) return [];
  return HEART_RATE_ZONES.map((zone, i) => ({
    zone,
    seconds: seconds[i] as number,
    share: (seconds[i] as number) / total,
  }));
}
