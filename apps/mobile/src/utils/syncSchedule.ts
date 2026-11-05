import { chainProof } from './chainProof';

export const BACKOFF_BASE_MS = 30_000;
export const BACKOFF_MAX_MS = 30 * 60_000;
/** After this many failed automatic tries an activity waits for the athlete to retry by hand. */
export const MAX_AUTO_ATTEMPTS = 8;

/** When to try again after `attempts` failures in a row: doubles each time, up to a cap. */
export function nextAttemptAt(now: number, attempts: number): number {
  return now + Math.min(BACKOFF_BASE_MS * 2 ** (attempts - 1), BACKOFF_MAX_MS);
}

type Candidate = {
  id: string;
  createdAt: Date;
  activityId?: string;
  onchainActivityId?: string;
  txHash?: string;
  sync?: { attempts: number; nextAttemptAt: number };
};

/** The activities worth another automatic try right now, oldest first. */
export function dueForSync<T extends Candidate>(
  activities: readonly T[],
  now: number,
  isInFlight: (id: string) => boolean
): T[] {
  return activities
    .filter((activity) => {
      if (chainProof(activity).state !== 'local') return false;
      if (isInFlight(activity.id)) return false;
      const { sync } = activity;
      if (!sync) return true;
      return sync.attempts < MAX_AUTO_ATTEMPTS && sync.nextAttemptAt <= now;
    })
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
