import type { AccuracyMode } from '@/stores/settingsStore';
import type { Location } from '@/types';
import { MIN_FIX_INTERVAL_MS, MIN_STEP_M } from '@/utils/fixClassifier';
import { haversineDistance } from '@/utils/geo';
import { logger } from '@/utils/logger';
import type {
  Clock,
  LocationPermission,
  LocationSource,
  Subscription,
  WatchOptions,
} from './ports';

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Calls `fn` every `ms` until the returned function is called. */
export type Scheduler = (fn: () => void, ms: number) => () => void;

const intervalScheduler: Scheduler = (fn, ms) => {
  const id = setInterval(fn, ms);
  return () => clearInterval(id);
};

/** Replayed fixes sit on a hill this high over a base altitude. */
const REPLAY_BASE_ALTITUDE_M = 560;
const REPLAY_HILL_M = 25;
const REPLAY_ACCURACY_M = 5;

/** The point `distanceM` meters along `route`, clamped to its ends. */
export function positionAlong(route: readonly LatLng[], distanceM: number): LatLng {
  const first = route[0];
  if (!first) throw new Error('positionAlong: an empty route has no positions');
  if (distanceM <= 0) return first;

  let walked = 0;
  for (let i = 1; i < route.length; i++) {
    const [a, b] = [route[i - 1], route[i]];
    if (!a || !b) continue;
    const leg = haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude);
    if (walked + leg >= distanceM && leg > 0) {
      const t = (distanceM - walked) / leg;
      return {
        latitude: a.latitude + (b.latitude - a.latitude) * t,
        longitude: a.longitude + (b.longitude - a.longitude) * t,
      };
    }
    walked += leg;
  }
  return route.at(-1) ?? first;
}

function routeLength(route: readonly LatLng[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    const [a, b] = [route[i - 1], route[i]];
    if (a && b) total += haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude);
  }
  return total;
}

interface Replay {
  route: readonly LatLng[];
  totalM: number;
  speedMps: number;
  startedAt: number;
  stop: () => void;
}

/**
 * Fix cadence for a replay: each tick must come at least `MIN_FIX_INTERVAL_MS` after the last and advance past
 * `MIN_STEP_M` (with room to spare), because trackingService drops closer fixes as GPS jitter; a fixed 1 Hz at
 * 3 m/s would emit 3 m steps and record 0 m.
 */
export function replayIntervalMs(speedMps: number): number {
  return Math.min(
    5000,
    Math.max(MIN_FIX_INTERVAL_MS, Math.ceil((MIN_STEP_M * 1.2 * 1000) / speedMps))
  );
}

/**
 * The real location source, except while a route is being replayed: then the
 * watchers get fixes walking that route in real time instead, so a whole
 * recording (splits, laps, territory, saving) can be driven from a desk.
 */
export class ScriptedLocationSource implements LocationSource {
  private readonly listeners = new Set<(fix: Location) => void>();
  private innerWatch: Subscription | null = null;
  private replay: Replay | null = null;
  private last: { distanceM: number; at: number; done: boolean } = {
    distanceM: 0,
    at: 0,
    done: false,
  };
  private lastFix: Location | null = null;
  private pending: { route: readonly LatLng[]; speedMps: number } | null = null;

  constructor(
    private readonly inner: LocationSource,
    private readonly clock: Clock,
    private readonly schedule: Scheduler = intervalScheduler
  ) {}

  get replaying(): boolean {
    return this.replay !== null;
  }

  progress(): { distanceM: number; totalM: number; at: number; done: boolean } {
    return { ...this.last, totalM: this.replay?.totalM ?? this.last.distanceM };
  }

  startReplay(route: readonly LatLng[], options: { speedMps: number; intervalMs?: number }): void {
    this.stopReplay();
    const { speedMps, intervalMs = replayIntervalMs(speedMps) } = options;
    const state: Replay = {
      route,
      totalM: routeLength(route),
      speedMps,
      startedAt: this.clock.now(),
      stop: () => {},
    };
    this.replay = state;
    this.last = { distanceM: 0, at: state.startedAt, done: false };
    this.emitReplayFix();
    state.stop = this.schedule(() => this.tick(), intervalMs);
  }

  /** True while a replay is waiting for a recording to begin. */
  get armed(): boolean {
    return this.pending !== null;
  }

  /**
   * Holds a replay back until a recording starts watching, so it can be set up in Developer tools
   * first and then played by tapping Start on the Record tab. The position preview before Start
   * (which asks for no distance filter) does not set it off.
   */
  armReplay(route: readonly LatLng[], options: { speedMps: number }): void {
    this.stopReplay();
    this.pending = { route, speedMps: options.speedMps };
  }

  disarmReplay(): void {
    this.pending = null;
  }

  stopReplay(): void {
    this.replay?.stop();
    this.replay = null;
  }

  private tick(): void {
    this.emitReplayFix();
    if (this.replay && this.last.distanceM >= this.replay.totalM) {
      this.last = { ...this.last, done: true };
      this.stopReplay();
    }
  }

  private emitReplayFix(): void {
    const replay = this.replay;
    if (!replay) return;
    const now = this.clock.now();
    const distanceM = Math.min(replay.totalM, ((now - replay.startedAt) / 1000) * replay.speedMps);
    const here = positionAlong(replay.route, distanceM);
    this.last = { distanceM, at: now, done: false };
    const fix: Location = {
      ...here,
      timestamp: now,
      accuracy: REPLAY_ACCURACY_M,
      // A real chip reports its speed; without it a still phone would look like a runner who stopped.
      speed: replay.speedMps,
      // A hill over the route (up, then back down), so the climb and descent can be seen end to end.
      altitude:
        REPLAY_BASE_ALTITUDE_M +
        REPLAY_HILL_M * Math.sin(Math.PI * (replay.totalM > 0 ? distanceM / replay.totalM : 0)),
      verticalAccuracy: 4,
    };
    this.lastFix = fix;
    for (const listener of [...this.listeners]) listener(fix);
  }

  getPermission(): Promise<LocationPermission> {
    return this.inner.getPermission();
  }

  requestPermission(): Promise<LocationPermission> {
    return this.inner.requestPermission();
  }

  async watch(options: WatchOptions, onFix: (fix: Location) => void): Promise<Subscription> {
    this.listeners.add(onFix);
    const armed = this.pending;
    if (armed && options.distanceIntervalM > 0) {
      this.pending = null;
      this.startReplay(armed.route, { speedMps: armed.speedMps });
    }
    // One real watcher feeds everyone; while replaying, its fixes are dropped.
    const attach = async () => {
      this.innerWatch ??= await this.inner.watch(options, (fix) => {
        if (this.replay) return;
        for (const listener of [...this.listeners]) listener(fix);
      });
    };
    if (this.replay) {
      // A replay needs no real GPS: with location off, or a watcher that never answers, it still runs.
      attach().catch((error) => logger.warn('[Replay] Real location watcher unavailable', error));
    } else {
      await attach();
    }
    return {
      remove: () => {
        this.listeners.delete(onFix);
        if (this.listeners.size === 0) {
          this.innerWatch?.remove();
          this.innerWatch = null;
        }
      },
    };
  }

  async getCurrent(accuracy: AccuracyMode): Promise<Location> {
    if (this.replay && this.lastFix) return this.lastFix;
    return this.inner.getCurrent(accuracy);
  }

  async getLastKnown(): Promise<Location | null> {
    if (this.replay && this.lastFix) return this.lastFix;
    return this.inner.getLastKnown();
  }

  async servicesEnabled(): Promise<boolean> {
    // A replay needs no real GPS, so switched-off location services do not matter while one runs.
    return this.replay !== null || this.pending !== null || this.inner.servicesEnabled();
  }

  openSettings(): Promise<void> {
    return this.inner.openSettings();
  }
}
