import type { Location } from '@/types';
import { haversineDistance } from './geo';

type Fix = Pick<Location, 'latitude' | 'longitude' | 'timestamp' | 'speed'>;

/**
 * The live pace reads zero once the newest fix is older than this (ms). Only the on-screen readout
 * uses it; auto-pause keeps its own, longer window for the chip's speed.
 */
export const LIVE_SPEED_STALE_MS = 3000;
/** Below this (m/s) the chip is only jittering while standing still, not measuring a pace. */
export const MIN_CHIP_SPEED_MS = 0.3;

/**
 * How far, and over how long, the athlete is moving right now: the basis of a live pace. When the
 * latest fix carries the GPS chip's own speed (a direct measurement, so it answers a change of pace
 * at once) and `now` says it is still fresh, that is used, as one second's worth of movement.
 * Otherwise it is how far the track went in the last `windowMs`, which is also what shows a stop.
 * When `now` is more than `staleMs` past the newest fix the position is unknown, so it reads zero.
 */
export function recentMovement(
  locations: readonly Fix[],
  windowMs: number,
  now?: number,
  staleMs: number = LIVE_SPEED_STALE_MS
): { distance: number; durationMs: number } {
  const last = locations.at(-1);
  if (!last) return { distance: 0, durationMs: 0 };

  if (now !== undefined && now - last.timestamp > staleMs) return { distance: 0, durationMs: 0 };

  if (
    now !== undefined &&
    last.speed !== undefined &&
    last.speed >= MIN_CHIP_SPEED_MS &&
    now - last.timestamp <= LIVE_SPEED_STALE_MS
  ) {
    return { distance: last.speed, durationMs: 1000 };
  }

  const recent = locations.filter((fix) => fix.timestamp >= last.timestamp - windowMs);
  const first = recent[0];
  if (!first || recent.length < 2) return { distance: 0, durationMs: 0 };

  let distance = 0;
  for (let i = 1; i < recent.length; i++) {
    const [a, b] = [recent[i - 1], recent[i]];
    if (a && b) distance += haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude);
  }
  return { distance, durationMs: last.timestamp - first.timestamp };
}
