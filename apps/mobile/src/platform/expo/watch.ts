import { requireOptionalNativeModule } from 'expo';
import { noWatch } from '@/platform/fakes/watch';
import type { WatchLink, WatchSample, WatchState, WatchStatus } from '@/platform/ports';
import { logger } from '@/utils/logger';

interface NativeEvents {
  onSample: (sample: WatchSample) => void;
  onState: (event: { state: WatchState }) => void;
}

/** The iOS module in modules/stryde-watch (see its Swift source). */
interface NativeWatch {
  status(): Promise<WatchStatus>;
  requestAccess(): Promise<WatchStatus>;
  start(sport: string): Promise<boolean>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  end(): Promise<void>;
  addListener<E extends keyof NativeEvents>(
    event: E,
    listener: NativeEvents[E]
  ): { remove(): void };
}

/** Logs and swallows a failed command: the recording carries on with the phone alone. */
async function quietly<T>(what: string, fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    logger.warn(`[Watch] ${what} failed`, error);
    return fallback;
  }
}

function link(native: NativeWatch): WatchLink {
  return {
    status: () => quietly('status', 'unsupported', () => native.status()),
    requestAccess: () => quietly('requestAccess', 'needs-permission', () => native.requestAccess()),
    start: (sport) => quietly('start', false, () => native.start(sport)),
    pause: () => quietly('pause', undefined, () => native.pause()),
    resume: () => quietly('resume', undefined, () => native.resume()),
    end: () => quietly('end', undefined, () => native.end()),
    onSample: (listener) => native.addListener('onSample', listener),
    onState: (listener) => native.addListener('onState', (event) => listener(event.state)),
  };
}

/** The Apple Watch on iOS builds that include the module; on Android and older builds, no watch. */
export const expoWatchLink: WatchLink = (() => {
  const native = requireOptionalNativeModule<NativeWatch>('StrydeWatch');
  return native ? link(native) : noWatch;
})();
