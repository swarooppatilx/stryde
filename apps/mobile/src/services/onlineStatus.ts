import { type Connectivity, lazyService } from '@/platform';
import { ignoreFailure } from '@/utils/ignoreFailure';

export interface OnlineStatus {
  getSnapshot(): boolean;
  subscribe(listener: () => void): () => void;
}

/** Runs `fn` once after `ms`; the returned function cancels it. */
export type Delay = (fn: () => void, ms: number) => () => void;

const timeoutDelay: Delay = (fn, ms) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

/** A tunnel or a lift drops the signal for a moment; shorter gaps than this are not shown. */
const OFFLINE_GRACE_MS = 500;

/**
 * Whether the device has a connection, kept for the life of the app. Assumes online until told
 * otherwise (an unknown reachability reads as online). Going offline is only reported once it has
 * lasted `OFFLINE_GRACE_MS`; coming back online is reported at once.
 */
export function createOnlineStatus(deps: {
  connectivity: Connectivity;
  schedule?: Delay;
}): OnlineStatus {
  const { connectivity, schedule = timeoutDelay } = deps;
  const listeners = new Set<() => void>();
  let online = true;
  let sawEvent = false;
  let cancelPendingOffline: (() => void) | null = null;

  function set(next: boolean): void {
    if (next === online) return;
    online = next;
    for (const listener of [...listeners]) listener();
  }

  function report(next: boolean): void {
    if (next) {
      cancelPendingOffline?.();
      cancelPendingOffline = null;
      set(true);
    } else if (online && !cancelPendingOffline) {
      cancelPendingOffline = schedule(() => {
        cancelPendingOffline = null;
        set(false);
      }, OFFLINE_GRACE_MS);
    }
  }

  connectivity.subscribe((next) => {
    sawEvent = true;
    report(next);
  });
  // The one-shot read can resolve after a live event already reported a newer state.
  // If it fails the state is unknown, and unknown counts as online.
  void connectivity
    .isOnline()
    .then((initial) => {
      if (!sawEvent) report(initial);
    })
    .catch(ignoreFailure);

  return {
    getSnapshot: () => online,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The app-wide status, built on first use from the installed platform. */
export const onlineStatus: OnlineStatus = lazyService((platform) =>
  createOnlineStatus({ connectivity: platform.connectivity })
);
