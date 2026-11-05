import { describe, expect, it } from 'vitest';
import { MAX_SPEED_KMH } from '@/constants/activity';
import { REPLAY_ROUTES, REPLAY_SPEEDS } from '@/constants/replayRoutes';
import {
  FakeClock,
  FakeLocationSource,
  installFakePlatform,
  straightTrack,
  uninstallFakePlatform,
} from '@/platform/fakes';
import { positionAlong, replayIntervalMs, ScriptedLocationSource } from '@/platform/replay';
import { createTrackingService } from '@/services/trackingService';
import type { ActivityType } from '@/types';
import { MIN_FIX_INTERVAL_MS, MIN_STEP_M } from '@/utils/fixClassifier';

const ROUTE = straightTrack({ speedMps: 1, durationS: 1000, intervalS: 500 }).map((f) => ({
  latitude: f.latitude,
  longitude: f.longitude,
}));

function setup() {
  const inner = new FakeLocationSource();
  const clock = new FakeClock();
  let tick: (() => void) | null = null;
  let cancelled = false;
  const source = new ScriptedLocationSource(inner, clock, (fn) => {
    tick = fn;
    cancelled = false;
    return () => {
      cancelled = true;
    };
  });
  const fixes: Array<{ latitude: number; timestamp: number; speed?: number }> = [];
  const advance = (ms: number) => {
    clock.advance(ms);
    tick?.();
  };
  return { inner, clock, source, fixes, advance, isCancelled: () => cancelled };
}

describe('positionAlong', () => {
  it('walks the polyline by distance, clamped to its ends', () => {
    const [start, end] = [ROUTE[0], ROUTE.at(-1)];
    expect(positionAlong(ROUTE, 0)).toEqual(start);
    expect(positionAlong(ROUTE, 10_000)).toEqual(end);
    const mid = positionAlong(ROUTE, 500);
    expect(mid.latitude).toBeGreaterThan(start?.latitude ?? 0);
    expect(mid.latitude).toBeLessThan(end?.latitude ?? 0);
  });
});

describe('ScriptedLocationSource', () => {
  it('passes real fixes through while no replay is running', async () => {
    const { inner, source, fixes } = setup();
    await source.watch({ accuracy: 'best', timeIntervalMs: 1000, distanceIntervalM: 1 }, (f) =>
      fixes.push(f)
    );

    inner.emit({ latitude: 1, longitude: 2, timestamp: 5, accuracy: 4 });

    expect(fixes).toEqual([{ latitude: 1, longitude: 2, timestamp: 5, accuracy: 4 }]);
  });

  it('replaces real fixes with the route, in real time at the chosen speed, while replaying', async () => {
    const { inner, source, fixes, advance } = setup();
    await source.watch({ accuracy: 'best', timeIntervalMs: 1000, distanceIntervalM: 1 }, (f) =>
      fixes.push(f)
    );

    source.startReplay(ROUTE, { speedMps: 3 });
    advance(10_000);
    inner.emit({ latitude: 99, longitude: 99, timestamp: 1, accuracy: 4 }); // a real fix: dropped

    expect(fixes).toHaveLength(2); // the start fix and one tick
    expect(fixes.every((f) => f.latitude !== 99)).toBe(true);
    expect(source.progress().distanceM).toBeCloseTo(30, 0);
    expect(fixes.at(-1)?.timestamp).toBe(source.progress().at);
  });

  it('reports the replay speed on each fix, as a real GPS chip would, so a still phone on a desk does not look like a stopped runner', async () => {
    const { source, fixes, advance } = setup();
    await source.watch({ accuracy: 'best', timeIntervalMs: 1000, distanceIntervalM: 1 }, (f) =>
      fixes.push(f)
    );

    source.startReplay(ROUTE, { speedMps: 3 });
    advance(10_000);

    expect(fixes.every((f) => f.speed === 3)).toBe(true);
  });

  it('starts watching at once during a replay even when the real GPS is off or never answers', async () => {
    const { inner, source, advance, fixes } = setup();
    inner.watch = () => new Promise(() => {}); // the real watcher never settles
    source.startReplay(ROUTE, { speedMps: 3 });

    await source.watch({ accuracy: 'best', timeIntervalMs: 1000, distanceIntervalM: 1 }, (f) =>
      fixes.push(f)
    );
    advance(5_000);

    expect(fixes.length).toBeGreaterThan(0);
  });

  it('stops by itself at the end of the route and goes back to real fixes', async () => {
    const { source, advance, isCancelled, fixes, inner } = setup();
    await source.watch({ accuracy: 'best', timeIntervalMs: 1000, distanceIntervalM: 1 }, (f) =>
      fixes.push(f)
    );

    source.startReplay(ROUTE, { speedMps: 100 });
    advance(60_000);

    expect(source.replaying).toBe(false);
    expect(isCancelled()).toBe(true);
    expect(source.progress().done).toBe(true);

    inner.emit({ latitude: 7, longitude: 7, timestamp: 9, accuracy: 4 });
    expect(fixes.at(-1)?.latitude).toBe(7);
  });

  it('answers current-position questions from the replay', async () => {
    const { source, advance } = setup();
    source.startReplay(ROUTE, { speedMps: 3 });
    advance(10_000);

    const current = await source.getCurrent('best');
    expect(current.latitude).toBeCloseTo(positionAlong(ROUTE, 30).latitude, 6);
  });

  it('an armed replay waits for a recording to start watching, not for the preview', async () => {
    const { source, fixes } = setup();
    const route = ROUTE;

    source.armReplay(route, { speedMps: 1 });
    expect(source.armed).toBe(true);
    expect(source.replaying).toBe(false);

    // The pre-start position preview does not set it off.
    await source.watch(
      { accuracy: 'balanced', timeIntervalMs: 1000, distanceIntervalM: 0 },
      () => {}
    );
    expect(source.replaying).toBe(false);

    // The recording's own watcher does, and receives the first fix at once.
    await source.watch({ accuracy: 'best', timeIntervalMs: 1000, distanceIntervalM: 1 }, (f) =>
      fixes.push(f)
    );
    expect(source.replaying).toBe(true);
    expect(source.armed).toBe(false);
    expect(fixes).toHaveLength(1);
  });

  it('disarming cancels a waiting replay', async () => {
    const { source } = setup();
    source.armReplay(ROUTE, { speedMps: 1 });
    source.disarmReplay();

    await source.watch({ accuracy: 'best', timeIntervalMs: 1000, distanceIntervalM: 1 }, () => {});

    expect(source.armed).toBe(false);
    expect(source.replaying).toBe(false);
  });

  it('reports location services as the real source does, except while a replay is running or armed', async () => {
    const { inner, source } = setup();
    inner.servicesOn = false;
    expect(await source.servicesEnabled()).toBe(false);

    source.armReplay(ROUTE, { speedMps: 1 });
    expect(await source.servicesEnabled()).toBe(true);

    source.disarmReplay();
    expect(await source.servicesEnabled()).toBe(false);

    source.startReplay(ROUTE, { speedMps: 1 });
    expect(await source.servicesEnabled()).toBe(true);
  });

  it('can be stopped by hand', () => {
    const { source, isCancelled } = setup();
    source.startReplay(ROUTE, { speedMps: 3 });
    source.stopReplay();

    expect(source.replaying).toBe(false);
    expect(isCancelled()).toBe(true);
  });
});

describe('replay → tracker seam', () => {
  const SPORT_FOR_TIER: Record<(typeof REPLAY_SPEEDS)[number]['value'], ActivityType> = {
    2.5: 'walk',
    6: 'run',
    8: 'ride',
  };
  const BASE_MS = new Date('2026-01-01T00:00:00.000Z').getTime();

  // Regression: the old fixed 1 Hz cadence spaced fixes 3 m apart at a 3 m/s walk,
  // and trackingService drops any fix less than 2 s or 3 m after the last one as GPS
  // jitter — plus any fix over the sport's speed cap — so a replay that is too
  // quick or too slow-moving recorded 0 m and finish() rejected the run as "too short".
  it('records real distance through the real tracker at every offered speed tier', async () => {
    const route = REPLAY_ROUTES[0].points;
    for (const tier of REPLAY_SPEEDS) {
      const sport = SPORT_FOR_TIER[tier.value];
      const platform = installFakePlatform();
      platform.clock.set(BASE_MS);
      try {
        const service = createTrackingService(platform);
        await service.startTracking(sport);
        service.setMaxSpeed(MAX_SPEED_KMH[sport]);

        let tick: (() => void) | null = null;
        const source = new ScriptedLocationSource(
          new FakeLocationSource(),
          platform.clock,
          (fn) => {
            tick = fn;
            return () => {};
          }
        );
        await source.watch(
          { accuracy: 'best', timeIntervalMs: 1000, distanceIntervalM: 1 },
          (fix) => service.addLocation(fix)
        );
        source.startReplay(route, { speedMps: tier.value });

        const intervalMs = replayIntervalMs(tier.value);
        // The invariant the gates care about: each tick comes at least MIN_FIX_INTERVAL_MS
        // after the last and travels at least MIN_STEP_M.
        expect(intervalMs).toBeGreaterThanOrEqual(MIN_FIX_INTERVAL_MS);
        expect(tier.value * (intervalMs / 1000)).toBeGreaterThanOrEqual(MIN_STEP_M);

        const advanceOnce = () => {
          platform.clock.advance(intervalMs);
          tick?.();
        };
        for (let i = 0; i < 500 && !source.progress().done; i++) advanceOnce();

        expect(source.progress().done).toBe(true);
        expect(service.getLocations().length).toBeGreaterThan(20);
        expect(service.getDistance()).toBeGreaterThan(300);
        await service.stopTracking();
      } finally {
        uninstallFakePlatform();
      }
    }
  });
});
