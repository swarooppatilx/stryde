import type { Location } from '@/types';
import { haversineDistance } from './geo';

/** Fixes reporting a horizontal accuracy worse than this (m) are not trusted. */
export const MAX_FIX_ACCURACY_M = 30;
/** Movement smaller than this (m) between two fixes is standing-still noise. */
export const MIN_STEP_M = 3;
/** A fix sooner than this (ms) after the last accepted one is dropped: chips repeat themselves at 1 Hz. */
export const MIN_FIX_INTERVAL_MS = 2000;
/** A fix stamped before this (2020-01-01 UTC) came from a device clock that was never set: it would corrupt every duration. */
export const MIN_PLAUSIBLE_FIX_TIME_MS = Date.UTC(2020, 0, 1);
/** Speeding up faster than this (m/s²) is a bad fix, not an athlete: it is just over 1 g. */
const MAX_ACCELERATION_MS2 = 11;
/** After this many rejected jumps in a row the next fix becomes the new reference. */
export const MAX_TELEPORT_REJECTS = 5;
/** The chip's own speed explains the jump if the implied speed is within this factor of it, plus slack. */
const SPEED_AGREEMENT_FACTOR = 3;
const SPEED_AGREEMENT_SLACK_MS = 3;

export type FixClass =
  | 'accept'
  | 'ignore-clock'
  | 'ignore-accuracy'
  | 'ignore-backwards'
  | 'ignore-jitter'
  | 'ignore-teleport'
  | 'ignore-acceleration';

export interface ClassifyOptions {
  /** Fastest plausible speed for the sport, in m/s. */
  maxSpeedMs: number;
  consecutiveTeleports: number;
  /** The accepted fix before `previous`, which gives the speed the athlete was already going. */
  beforePrevious?: Location;
}

/**
 * Decides whether a new fix may extend the track, given the last one that did. Order matters: a fix
 * stamped by an unset clock or with poor accuracy is dropped before anything else; then time must move forward; then standing noise; then a jump
 * is a teleport if it is faster than the sport allows, or faster than the GPS chip's own speed reading
 * can explain (which catches a bad fix after a quiet spell, when the average speed looks plausible).
 */
export function classifyFix(
  fix: Location,
  previous: Location | undefined,
  { maxSpeedMs, consecutiveTeleports, beforePrevious }: ClassifyOptions
): FixClass {
  if (fix.timestamp < MIN_PLAUSIBLE_FIX_TIME_MS) return 'ignore-clock';
  if (fix.accuracy > MAX_FIX_ACCURACY_M) return 'ignore-accuracy';
  if (!previous) return 'accept';

  const seconds = (fix.timestamp - previous.timestamp) / 1000;
  if (seconds <= 0) return 'ignore-backwards';

  const meters = haversineDistance(
    previous.latitude,
    previous.longitude,
    fix.latitude,
    fix.longitude
  );
  if (meters < MIN_STEP_M || seconds * 1000 < MIN_FIX_INTERVAL_MS) return 'ignore-jitter';

  const implied = meters / seconds;
  const tooFast = implied > maxSpeedMs;
  const chipDisagrees =
    fix.speed !== undefined &&
    implied > fix.speed * SPEED_AGREEMENT_FACTOR + SPEED_AGREEMENT_SLACK_MS;
  if ((tooFast || chipDisagrees) && consecutiveTeleports < MAX_TELEPORT_REJECTS) {
    return 'ignore-teleport';
  }
  if (beforePrevious && consecutiveTeleports < MAX_TELEPORT_REJECTS) {
    const earlier = (previous.timestamp - beforePrevious.timestamp) / 1000;
    if (earlier > 0) {
      const before =
        haversineDistance(
          beforePrevious.latitude,
          beforePrevious.longitude,
          previous.latitude,
          previous.longitude
        ) / earlier;
      if (Math.abs(implied - before) / seconds >= MAX_ACCELERATION_MS2) {
        return 'ignore-acceleration';
      }
    }
  }
  return 'accept';
}
