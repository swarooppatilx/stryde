import { GPS_DISTANCE_SPORTS, MAX_SPEED_KMH } from '@/constants/activity';
import type { ActivityType } from '@/types';
import { parseDecimal } from './challengeForm';

const MAX_DISTANCE_M = 1_000_000;
const MAX_MINUTES = 72 * 60;

export interface ManualEntryInput {
  sport: ActivityType;
  distanceInput: string;
  minutesInput: string;
  /** 1000 for km, 1609.344 for miles. */
  metersPerUnit: number;
}

export type ManualEntryResult =
  | { ok: true; distance: number; duration: number }
  | { ok: false; reason: string };

/** Checks a typed-in activity and says what's wrong in plain words. Distance is optional for sports that have none (yoga, workout...). */
export function validateManualEntry(input: ManualEntryInput): ManualEntryResult {
  const minutes = parseDuration(input.minutesInput);
  if (input.minutesInput.trim() === '' || minutes === null || minutes <= 0) {
    return { ok: false, reason: 'Enter how long it took' };
  }
  if (minutes > MAX_MINUTES) return { ok: false, reason: 'Duration is too long (max 72 hours)' };

  const needsDistance = GPS_DISTANCE_SPORTS.has(input.sport);
  let distance = 0;
  if (input.distanceInput.trim() !== '' || needsDistance) {
    const typed = parseDecimal(input.distanceInput);
    if (typed === null || typed <= 0) return { ok: false, reason: 'Enter the distance' };
    distance = Math.round(typed * input.metersPerUnit);
    if (distance > MAX_DISTANCE_M) {
      return { ok: false, reason: 'Distance is too large (max 1,000 km)' };
    }
    const kmh = distance / 1000 / (minutes / 60);
    const limit = MAX_SPEED_KMH[input.sport];
    if (kmh > limit) {
      return {
        ok: false,
        reason: `That is faster than possible for ${article(input.sport)} (${Math.round(limit)} km/h max)`,
      };
    }
  }
  return { ok: true, distance, duration: Math.round(minutes * 60_000) };
}

/** Minutes as a number ("30", "7,5"), or hours and minutes ("1:30"). Null when it is neither. */
function parseDuration(input: string): number | null {
  const text = input.trim();
  const clock = /^(\d+):(\d{1,2})$/.exec(text);
  if (clock) {
    const minutes = Number(clock[2]);
    return minutes < 60 ? Number(clock[1]) * 60 + minutes : null;
  }
  return parseDecimal(text);
}

/**
 * Returns the selected local date and time unless it is now or in the future.
 * Undefined means "now"; the date picker cannot choose a future day, but the time can be later today.
 */
export function manualStartedAt(day: Date, now: number): number | undefined {
  const at = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    day.getHours(),
    day.getMinutes()
  ).getTime();
  return at < now ? at : undefined;
}

function article(sport: ActivityType): string {
  return /^[aeiou]/.test(sport) ? `an ${sport}` : `a ${sport}`;
}

export interface DiscardCheck {
  /** The numbers came from a recording, which can't be re-created. */
  recorded: boolean;
  titleEdited: boolean;
  description: string;
  photoCount: number;
  distanceInput: string;
  minutesInput: string;
  /** The note only the athlete sees, if they have started one. */
  privateNote?: string;
}

/** Whether closing the form would throw away something the user made. The auto-filled title doesn't count. */
export function shouldConfirmDiscard(check: DiscardCheck): boolean {
  return (
    check.recorded ||
    check.titleEdited ||
    check.description.trim() !== '' ||
    check.photoCount > 0 ||
    check.distanceInput.trim() !== '' ||
    check.minutesInput.trim() !== '' ||
    (check.privateNote ?? '').trim() !== ''
  );
}
