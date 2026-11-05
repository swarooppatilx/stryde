import type { Clock } from '@/platform/ports';

/** What the app can note about itself. Names only: no addresses, ids or other personal data. */
export type EventName =
  | 'activity.saved'
  | 'activity.confirmed'
  | 'activity.indexed'
  | 'record.rejections';

export interface AppEvent {
  at: number;
  name: EventName;
  /** Time since the athlete's save, when the event marks a step after it. */
  durationMs?: number;
  ok?: boolean;
  /** Counts by name, for a summary event such as the fixes a recording ignored. */
  counts?: Record<string, number>;
  /** A short random tag for this app run, so one run's events can be told from another's. */
  run: string;
}

export const EVENT_LOG_CAPACITY = 200;

export interface EventLog {
  record(
    name: EventName,
    detail?: { durationMs?: number; ok?: boolean; counts?: Record<string, number> }
  ): void;
  /** Oldest first. A copy: later events do not change it. */
  snapshot(): AppEvent[];
}

const randomRunId = () => Math.random().toString(36).slice(2, 8);

/** A bounded in-memory log of what happened and how long it took. Never stored or sent anywhere. */
export function createEventLog(clock: Clock, runId: string = randomRunId()): EventLog {
  const events: AppEvent[] = [];
  return {
    record(name, detail) {
      const event: AppEvent = { at: clock.now(), name, run: runId };
      if (detail?.durationMs !== undefined) event.durationMs = detail.durationMs;
      if (detail?.ok !== undefined) event.ok = detail.ok;
      if (detail?.counts !== undefined) event.counts = { ...detail.counts };
      events.push(event);
      if (events.length > EVENT_LOG_CAPACITY) events.splice(0, events.length - EVENT_LOG_CAPACITY);
    },
    snapshot: () => events.map((e) => ({ ...e })),
  };
}
