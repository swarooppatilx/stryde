import type { Platform } from './ports';

export type * from './ports';

let current: Platform | null = null;

/** Cache-clearers of every `lazyService`, so a new platform never meets a service built on the old one. */
const lazyResets = new Set<() => void>();

export function installPlatform(platform: Platform): void {
  current = platform;
  for (const reset of lazyResets) reset();
}

export function resetPlatform(): void {
  current = null;
  for (const reset of lazyResets) reset();
}

export function getPlatform(): Platform {
  if (!current) {
    throw new Error(
      '[platform] No platform installed. The app installs one in entrypoint.js; tests call installFakePlatform().'
    );
  }
  return current;
}

/**
 * A service built on first use from the installed platform. Call sites keep
 * importing one stable object (`trackingService.addLocation(...)`) while the
 * instance behind it follows the active platform — real in the app, fake in tests.
 */
export function lazyService<T extends object>(factory: (platform: Platform) => T): T {
  let instance: T | null = null;
  lazyResets.add(() => {
    instance = null;
  });
  const resolve = (): T => {
    if (!instance) instance = factory(getPlatform());
    return instance;
  };
  return new Proxy({} as T, {
    get(_target, property) {
      const value = Reflect.get(resolve(), property);
      return typeof value === 'function' ? value.bind(resolve()) : value;
    },
  });
}
