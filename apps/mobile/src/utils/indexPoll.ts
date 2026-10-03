import type { Clock } from '@/platform/ports';

/** Asks the search index whether an activity is visible yet: null when there is no index to ask. */
export interface IndexReader {
  isVisible(activityHash: string, owner: string): Promise<boolean | null>;
}

export interface IndexPollDeps {
  reader: IndexReader;
  clock: Clock;
  /** Resolves after `ms`, or early when the signal aborts. */
  sleep(ms: number, signal: AbortSignal): Promise<void>;
  isOnline(): Promise<boolean>;
}

/** Waits between tries: 11 gaps for 12 tries, about 54 s in all. */
export const POLL_DELAYS_MS = [1000, 2000, 3000, 4000, 5000, 5000, 6000, 6000, 7000, 7000, 8000];

export type IndexPollResult =
  | { outcome: 'found'; at: number }
  | { outcome: 'gave_up' | 'cancelled' | 'offline' | 'unavailable' };

/** Polls, within bounds, until the activity shows up in the index. Never throws. */
export async function pollUntilIndexed(
  activityHash: string,
  owner: string,
  signal: AbortSignal,
  deps: IndexPollDeps
): Promise<IndexPollResult> {
  for (let attempt = 0; attempt <= POLL_DELAYS_MS.length; attempt++) {
    if (signal.aborted) return { outcome: 'cancelled' };
    if (!(await deps.isOnline().catch(() => false))) return { outcome: 'offline' };
    let visible: boolean | null = false;
    try {
      visible = await deps.reader.isVisible(activityHash, owner);
    } catch {
      visible = false; // a failed read is just "not yet"
    }
    if (signal.aborted) return { outcome: 'cancelled' };
    if (visible === null) return { outcome: 'unavailable' };
    if (visible) return { outcome: 'found', at: deps.clock.now() };
    const delay = POLL_DELAYS_MS[attempt];
    if (delay !== undefined) await deps.sleep(delay, signal);
  }
  return { outcome: 'gave_up' };
}
