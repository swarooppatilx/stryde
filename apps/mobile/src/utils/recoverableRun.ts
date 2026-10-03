import { MAX_SPEED_KMH } from '@/constants/activity';
import type { ActivityType } from '@/types';
import { formatDay } from './dates';
import { formatDistance, type UnitSystem } from './format';
import { haversineDistance } from './geo';
import { isTooShort } from './minimumRun';
import { pairs } from './pairs';

/** Where the tracker keeps the recording in progress, so a killed app can pick it up again. */
export const TRACKING_STORAGE_KEY = '@stryde/tracking';

/** A recording left this long ago is still offered, but named by its date. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
/** A start with no fix and less time than this was a mis-tap, not a run worth recovering. */
const MIN_RECOVERABLE_MS = 5000;

export interface RecoverableRun {
  activityType: ActivityType;
  distanceM: number;
  /** Time spent recording, not the hours the app was dead. */
  durationMs: number;
  startedAt: number;
  stale: boolean;
  /** Too short to be saved as an activity: only worth resuming or discarding. */
  tooShort: boolean;
  /** One sentence for the recovery prompt. */
  text: string;
}

interface Fix {
  latitude: number;
  longitude: number;
}

const isFix = (value: unknown): value is Fix =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Fix).latitude === 'number' &&
  typeof (value as Fix).longitude === 'number';

const minutesText = (ms: number) =>
  ms < 60_000 ? 'under a minute' : `${Math.round(ms / 60_000)} min`;

/**
 * Reads the stored recording without touching any sensor or session state, and says what is in it.
 * Null when there is nothing worth offering back.
 */
export function describeRecoverableRun(
  blob: string | null,
  now: number,
  unitSystem: UnitSystem = 'metric'
): RecoverableRun | null {
  if (!blob) return null;
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(blob);
    if (typeof parsed !== 'object' || parsed === null) return null;
    data = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const startedAt = data.startTime;
  if (typeof startedAt !== 'number') return null;

  const fixes = Array.isArray(data.locations) ? data.locations.filter(isFix) : [];
  const pausedFor = typeof data.pausedDuration === 'number' ? data.pausedDuration : 0;
  // The clock stopped at the pause, or at the last save for a run that was still going.
  let stoppedAt = now;
  if (data.isTracking !== true && typeof data.pauseStartTime === 'number') {
    stoppedAt = data.pauseStartTime;
  } else if (typeof data.lastPersistTime === 'number') {
    stoppedAt = data.lastPersistTime;
  }
  const durationMs = Math.max(0, stoppedAt - startedAt - pausedFor);
  if (fixes.length === 0 && durationMs < MIN_RECOVERABLE_MS) return null;

  let distanceM = 0;
  for (const [from, to] of pairs(fixes)) {
    distanceM += haversineDistance(from.latitude, from.longitude, to.latitude, to.longitude);
  }
  const stored = data.activityType;
  const activityType: ActivityType =
    typeof stored === 'string' && stored in MAX_SPEED_KMH ? (stored as ActivityType) : 'run';

  const stale = now - startedAt > STALE_AFTER_MS;
  const figures = `${formatDistance(distanceM, unitSystem)}, ${minutesText(durationMs)}`;
  const text = stale
    ? `We found an unfinished run from ${formatDay(startedAt)}: ${figures}`
    : `We recovered your run: ${figures}`;

  return {
    activityType,
    distanceM,
    durationMs,
    startedAt,
    stale,
    tooShort: isTooShort(activityType, distanceM),
    text,
  };
}
