import type { Clock } from '@/platform/ports';
import type { EventLog } from './eventLog';
import type { IndexPollResult } from './indexPoll';

/** How far along one just-saved activity is, in ms since the save; absent while still pending. */
export interface TimingState {
  confirmedMs?: number;
  indexedMs?: number;
}

export interface TimeToIndexedDeps {
  clock: Clock;
  log: EventLog;
  poll(activityHash: string, owner: string, signal: AbortSignal): Promise<IndexPollResult>;
}

const NONE: TimingState = {};

/** Measures save -> confirmed -> visible in search, per activity, in memory only. */
export function createTimeToIndexed({ clock, log, poll }: TimeToIndexedDeps) {
  const started = new Map<string, number>();
  const states = new Map<string, TimingState>();
  const runs = new Map<string, AbortController>();
  const listeners = new Set<() => void>();
  const set = (id: string, state: TimingState) => {
    states.set(id, state);
    for (const l of [...listeners]) l();
  };

  return {
    saved(id: string) {
      started.set(id, clock.now());
      log.record('activity.saved');
    },
    /** The record is confirmed: note the time, then watch for it to appear in search. */
    confirmed(id: string, activityHash: string, owner: string) {
      const start = started.get(id);
      if (start === undefined) return; // not saved in this run: no honest start time
      const confirmedMs = clock.now() - start;
      log.record('activity.confirmed', { durationMs: confirmedMs, ok: true });
      set(id, { confirmedMs });
      const controller = new AbortController();
      runs.set(id, controller);
      void poll(activityHash, owner, controller.signal).then((result) => {
        if (runs.get(id) === controller) runs.delete(id);
        if (result.outcome !== 'found') return;
        const indexedMs = result.at - start;
        log.record('activity.indexed', { durationMs: indexedMs, ok: true });
        set(id, { confirmedMs, indexedMs });
      });
    },
    /** Stops watching (the screen went away). */
    cancel(id: string) {
      runs.get(id)?.abort();
      runs.delete(id);
    },
    get: (id: string): TimingState => states.get(id) ?? NONE,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type TimeToIndexed = ReturnType<typeof createTimeToIndexed>;

/** "3.1 s" for the chip. */
export const formatSeconds = (ms: number): string => `${(Math.max(0, ms) / 1000).toFixed(1)} s`;
