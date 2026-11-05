import type { LocationSource, Subscription } from '@/platform';
import type { Location } from '@/types';

export interface GpsPreview {
  /** The newest fix, or null before the first one. A new value whenever it changes. */
  getSnapshot(): Location | null;
  subscribe(listener: () => void): () => void;
  /** Starts listening if location is already allowed; it never asks for permission. */
  start(): Promise<void>;
  stop(): void;
}

const PREVIEW_INTERVAL_MS = 3000;

/**
 * Lets the Record screen show GPS quality before a run starts. It only listens while
 * the screen asks it to, and only when location is already allowed: a permission
 * prompt belongs to pressing Start, not to opening a tab.
 */
export function createGpsPreview(deps: { location: LocationSource }): GpsPreview {
  const { location } = deps;
  const listeners = new Set<() => void>();
  let fix: Location | null = null;
  let watcher: Subscription | null = null;
  let pending: Promise<void> | null = null;
  /** Bumped by `stop` so a watcher still being created knows it is no longer wanted. */
  let generation = 0;

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  async function begin(wanted: number): Promise<void> {
    try {
      await listen(wanted);
    } catch {
      // A switched-off GPS is a normal state here: the signal bar already says "waiting".
    }
  }

  async function listen(wanted: number): Promise<void> {
    const permission = await location.getPermission();
    if (!permission.granted || wanted !== generation) return;
    const subscription = await location.watch(
      { accuracy: 'balanced', timeIntervalMs: PREVIEW_INTERVAL_MS, distanceIntervalM: 0 },
      (next) => {
        fix = next;
        notify();
      }
    );
    if (wanted !== generation) {
      subscription.remove();
      return;
    }
    watcher = subscription;
  }

  return {
    getSnapshot: () => fix,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (watcher) return Promise.resolve();
      if (!pending) {
        const attempt = begin(generation).finally(() => {
          // A newer attempt may have replaced this one; only clear the current one.
          if (pending === attempt) pending = null;
        });
        pending = attempt;
      }
      return pending;
    },
    stop() {
      generation++;
      watcher?.remove();
      watcher = null;
      pending = null;
      if (fix) {
        fix = null;
        notify();
      }
    },
  };
}
