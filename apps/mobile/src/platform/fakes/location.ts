import type {
  BackgroundLocation,
  Geocoder,
  LocationPermission,
  LocationSource,
  Subscription,
  WatchOptions,
} from '@/platform/ports';
import type { AccuracyMode } from '@/stores/settingsStore';
import type { Location } from '@/types';

/** Foreground GPS driven by the test: grant/deny permission, `emit` fixes, replay whole tracks. */
export class FakeLocationSource implements LocationSource {
  permission: LocationPermission = { granted: true, canAskAgain: true };
  /** What the OS answers when asked; the permission becomes this result. */
  onRequest: LocationPermission = { granted: true, canAskAgain: true };
  requestCount = 0;
  settingsOpened = 0;
  current: Location | null = null;
  lastKnown: Location | null = null;
  watchOptions: WatchOptions | null = null;
  private listeners = new Set<(fix: Location) => void>();

  get activeWatchers(): number {
    return this.listeners.size;
  }

  async getPermission(): Promise<LocationPermission> {
    return { ...this.permission };
  }

  async requestPermission(): Promise<LocationPermission> {
    this.requestCount++;
    this.permission = { ...this.onRequest };
    return { ...this.permission };
  }

  async watch(options: WatchOptions, onFix: (fix: Location) => void): Promise<Subscription> {
    this.watchOptions = options;
    this.listeners.add(onFix);
    return { remove: () => this.listeners.delete(onFix) };
  }

  async getCurrent(_accuracy: AccuracyMode): Promise<Location> {
    if (!this.current) throw new Error('FakeLocationSource: no current fix set');
    return this.current;
  }

  async getLastKnown(): Promise<Location | null> {
    return this.lastKnown;
  }

  /** Set false to play a phone with location services switched off. */
  servicesOn = true;

  async servicesEnabled(): Promise<boolean> {
    return this.servicesOn;
  }

  async openSettings(): Promise<void> {
    this.settingsOpened++;
  }

  emit(fix: Location): void {
    for (const listener of [...this.listeners]) listener(fix);
  }

  /** Emits each fix in order; `beforeEach` lets a test move the clock to the fix's time first. */
  play(fixes: Location[], beforeEach?: (fix: Location) => void): void {
    for (const fix of fixes) {
      beforeEach?.(fix);
      this.emit(fix);
    }
  }
}

/** Background buffer that only records while started, like the real foreground-service task. */
export class FakeBackgroundLocation implements BackgroundLocation {
  startResult = true;
  started = false;
  mode: AccuracyMode | null = null;
  activityName: string | null = null;
  buffer: Location[] = [];
  /** Counts `requestPermission()` calls so a test can assert the banner re-asked. */
  permissionRequests = 0;

  async start(mode: AccuracyMode, activityName: string): Promise<boolean> {
    if (!this.startResult) return false;
    this.started = true;
    this.mode = mode;
    this.activityName = activityName;
    return true;
  }

  async stop(): Promise<void> {
    this.started = false;
  }

  async requestPermission(): Promise<void> {
    this.permissionRequests++;
  }

  async peek(): Promise<Location[]> {
    return [...this.buffer];
  }

  async clear(): Promise<void> {
    this.buffer = [];
  }

  /** A fix delivered by the OS while the app is backgrounded. */
  deliver(fix: Location): void {
    if (this.started) this.buffer.push(fix);
  }
}

/** Scripted places: `places` maps a query to its hits; `names` maps "lat,lng" to a name. */
export class FakeGeocoder implements Geocoder {
  places = new Map<string, Array<{ latitude: number; longitude: number }>>();
  names = new Map<string, string>();
  failNext: Error | null = null;
  queries: string[] = [];

  async geocode(query: string) {
    this.queries.push(query);
    if (this.failNext) {
      const error = this.failNext;
      this.failNext = null;
      throw error;
    }
    return this.places.get(query) ?? [];
  }

  async placeName(latitude: number, longitude: number) {
    return this.names.get(`${latitude},${longitude}`) ?? null;
  }
}
