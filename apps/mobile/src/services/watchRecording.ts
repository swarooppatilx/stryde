import type {
  Subscription,
  WatchLink,
  WatchSample,
  WatchSport,
  WatchState,
} from '@/platform/ports';
import type { ActivityType } from '@/types';
import { logger } from '@/utils/logger';

/** No reading for this long while running means the watch dropped out (out of range, app closed). */
export const WATCH_STALE_MS = 10_000;

/** What the tracking screen shows from the watch; each value is the latest one still fresh. */
export interface LiveWatch {
  state: WatchState;
  heartRate?: number;
  cadence?: number;
  power?: number;
  calories?: number;
  distance?: number;
}

const SPORT: Partial<Record<ActivityType, WatchSport>> = {
  run: 'run',
  walk: 'walk',
  hike: 'hike',
  ride: 'ride',
};

/** The watch workout for a Stryde sport; null for sports the watch link doesn't record. */
export function watchSportOf(activityType: ActivityType): WatchSport | null {
  return SPORT[activityType] ?? null;
}

interface Handlers {
  /** Something the screen shows changed. */
  onChange(): void;
  /** Pause or resume was pressed on the watch. */
  onRemote(state: 'paused' | 'running'): void;
}

/**
 * One recording's link to the watch: starts its workout, keeps its readings, passes pause/resume both ways.
 * A watch that can't be reached or drops out never stops the recording; the phone carries on alone.
 */
export function createWatchRecording(link: WatchLink, handlers: Handlers) {
  let samples: WatchSample[] = [];
  let state: WatchState | null = null;
  let latest: Omit<LiveWatch, 'state'> = {};
  let lastAt = 0;
  let subs: Subscription[] = [];

  function onSample(sample: WatchSample): void {
    samples.push(sample);
    lastAt = Date.now();
    latest = {
      heartRate: sample.heartRate ?? latest.heartRate,
      cadence: sample.cadence ?? latest.cadence,
      power: sample.power ?? latest.power,
      calories: sample.calories ?? latest.calories,
      distance: sample.distance ?? latest.distance,
    };
    if (state === 'disconnected') state = 'running';
    handlers.onChange();
  }

  function onState(next: WatchState): void {
    const before = state;
    state = next;
    if (next === 'running') lastAt = Date.now();
    // Pressed on the watch: the phone follows. A command the phone sent comes back as the same state, so it is ignored.
    if ((next === 'paused' || next === 'running') && before !== next && before !== null) {
      handlers.onRemote(next);
    }
    handlers.onChange();
  }

  function listen(): void {
    if (subs.length > 0) return;
    subs = [link.onSample(onSample), link.onState(onState)];
  }

  function detach(): void {
    for (const sub of subs) sub.remove();
    subs = [];
  }

  return {
    /** Opens the watch app and starts its workout; the recording doesn't wait for it. */
    connect(sport: WatchSport): void {
      listen();
      state = 'running';
      lastAt = Date.now();
      void link
        .start(sport)
        .then((reached) => {
          if (reached) return;
          logger.info('[Watch] Could not reach the watch; recording with the phone alone');
          state = null;
          detach();
          handlers.onChange();
        })
        .catch((error) => logger.warn('[Watch] Start failed', error));
    },

    /** After the app restarted mid-run: listens again to a watch workout that kept going. */
    reattach(): void {
      listen();
      state = 'running';
      lastAt = Date.now();
    },

    pause(): void {
      if (state === null || state === 'paused') return;
      state = 'paused';
      void link.pause();
    },

    resume(): void {
      if (state === null || state === 'running') return;
      state = 'running';
      lastAt = Date.now();
      void link.resume();
    },

    /** Ends the watch workout and stops listening; the readings stay for the summary. */
    async end(): Promise<void> {
      if (state !== null && state !== 'ended') await link.end();
      detach();
      state = null;
    },

    /** Called each second: a running watch that went quiet is marked disconnected. */
    checkStale(now: number): void {
      if (state === 'running' && now - lastAt > WATCH_STALE_MS) {
        state = 'disconnected';
        handlers.onChange();
      }
    },

    live(): LiveWatch | null {
      if (state === null) return null;
      // Old numbers would look live; a dropped watch shows none until it comes back.
      return state === 'disconnected' ? { state } : { state, ...latest };
    },

    samples: (): readonly WatchSample[] => samples,

    /** Forgets this recording's readings (a new run, or after the summary was built). */
    reset(): void {
      detach();
      samples = [];
      state = null;
      latest = {};
      lastAt = 0;
    },
  };
}

export type WatchRecording = ReturnType<typeof createWatchRecording>;
