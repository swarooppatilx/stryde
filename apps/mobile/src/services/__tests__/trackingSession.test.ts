import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  at,
  FAKE_EPOCH_MS,
  FakeLocationSource,
  type FakePlatform,
  installFakePlatform,
  loopTrack,
  PUNE,
  straightTrack,
  uninstallFakePlatform,
} from '@/platform/fakes';
import { territoryService } from '@/services/territoryService';
import { createTrackingService } from '@/services/trackingService';
import {
  createTrackingSession,
  type SessionOptions,
  type TrackingSession,
} from '@/services/trackingSession';
import type { Location } from '@/types';
import { METERS_PER_MILE } from '@/utils/format';

const OPTS: SessionOptions = {
  activityType: 'run',
  activityLabel: 'Run',
  accuracyMode: 'best',
  timeIntervalMs: 1000,
  useGyroscope: false,
  autoPause: false,
};

let platform: FakePlatform;
let permissionGranted: boolean;

function buildSession(
  overrides: Partial<FakePlatform> = {},
  recordRejections?: (c: object) => void
) {
  const deps = { ...platform, ...overrides };
  const tracking = createTrackingService(deps);
  const session = createTrackingSession({
    tracking,
    territory: territoryService,
    location: deps.location,
    background: deps.background,
    motion: deps.motion,
    haptics: deps.haptics,
    speaker: deps.speaker,
    screenAwake: deps.screenAwake,
    ensureLocationPermission: async () => permissionGranted,
    clock: deps.clock,
    recordRejections,
  });
  return { tracking, session, deps };
}

let tracking: ReturnType<typeof createTrackingService>;
let session: TrackingSession;

/** Deliver fixes as the OS would, moving the clock to each fix's time first. */
function play(fixes: Location[], source: FakeLocationSource = platform.location): void {
  source.play(fixes, (fix) => platform.clock.set(fix.timestamp));
}

beforeEach(() => {
  vi.useFakeTimers();
  platform = installFakePlatform();
  permissionGranted = true;
  ({ tracking, session } = buildSession());
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  uninstallFakePlatform();
});

describe('starting', () => {
  it('begins recording: tracking on, GPS watched, background task running', async () => {
    const result = await session.start(OPTS);

    expect(result).toEqual({ ok: true });
    expect(session.getSnapshot().status).toBe('tracking');
    expect(tracking.getIsTracking()).toBe(true);
    expect(platform.location.activeWatchers).toBe(1);
    expect(platform.location.watchOptions).toEqual({
      accuracy: 'best',
      timeIntervalMs: 1000,
      distanceIntervalM: 1,
    });
    expect(platform.background.started).toBe(true);
    expect(platform.background.activityName).toBe('Run');
    expect(platform.background.mode).toBe('best');
  });

  it('says when recording cannot continue in the background', async () => {
    platform.background.startResult = false;

    await session.start(OPTS);

    await vi.waitFor(() => expect(session.getSnapshot().backgroundOff).toBe(true));
    expect(session.getSnapshot().status).toBe('tracking');
  });

  it('gets background recording going when the athlete grants it after the run began', async () => {
    platform.background.startResult = false;
    await session.start(OPTS);
    await vi.waitFor(() => expect(session.getSnapshot().backgroundOff).toBe(true));

    // Back from Settings with "all the time" granted — the retry runs on that foreground return.
    platform.background.startResult = true;
    await session.syncBackground();

    await vi.waitFor(() => expect(platform.background.started).toBe(true));
    expect(session.getSnapshot().backgroundOff).toBe(false);
    expect(session.getSnapshot().status).toBe('tracking');
  });

  it('reports background recording as on when it starts', async () => {
    await session.start(OPTS);

    await vi.waitFor(() => expect(platform.background.started).toBe(true));
    expect(session.getSnapshot().backgroundOff).toBe(false);
  });

  it('does nothing when the user refuses location', async () => {
    permissionGranted = false;

    const result = await session.start(OPTS);

    expect(result).toEqual({ ok: false, reason: 'permission' });
    expect(session.getSnapshot().status).toBe('idle');
    expect(tracking.getStartTime()).toBeNull();
    expect(platform.background.started).toBe(false);
    expect(platform.location.activeWatchers).toBe(0);
  });

  it('explains a GPS that is switched off, and leaves nothing half-started', async () => {
    platform.location.watch = async () => {
      throw new Error('Location request failed due to unsatisfied device settings');
    };

    const result = await session.start(OPTS);

    expect(result).toEqual({
      ok: false,
      reason: 'gps',
      message: 'Turn on device location (GPS) to track this activity.',
    });
    expect(session.getSnapshot().status).toBe('idle');
    expect(tracking.getIsTracking()).toBe(false);
    expect(platform.background.started).toBe(false);
  });

  it('gives up with a clear message when the GPS never answers, instead of hanging on Start', async () => {
    let removed = false;
    const lateWatcher = {
      remove: () => {
        removed = true;
      },
    };
    platform.location.watch = () =>
      new Promise((resolve) => setTimeout(() => resolve(lateWatcher), 60_000));

    const pending = session.start(OPTS);
    await vi.advanceTimersByTimeAsync(20_000);
    const result = await pending;

    expect(result).toEqual({
      ok: false,
      reason: 'gps',
      message: "Couldn't get a GPS signal. Make sure location is on, then try again.",
    });
    expect(session.getSnapshot().status).toBe('idle');
    expect(tracking.getIsTracking()).toBe(false);

    // The watcher that finally arrives is not left running in the background.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(removed).toBe(true);
  });

  it('refuses to start a second session on top of a running one', async () => {
    await session.start(OPTS);

    expect(await session.start(OPTS)).toEqual({ ok: false, reason: 'busy' });
    expect(platform.location.activeWatchers).toBe(1);
  });

  it('drops points a previous aborted run left in the background buffer', async () => {
    platform.background.buffer = [
      { latitude: 1, longitude: 1, timestamp: FAKE_EPOCH_MS - 60_000, accuracy: 5 },
    ];

    await session.start(OPTS);

    expect(await platform.background.peek()).toEqual([]);
  });

  it('applies the activity speed limit, so a ride is not thrown away as a run', async () => {
    await session.start({ ...OPTS, activityType: 'ride', activityLabel: 'Ride' });

    play(straightTrack({ speedMps: 10, durationS: 60, intervalS: 2 }));

    expect(tracking.getLocations().length).toBeGreaterThan(25);
    expect(session.getSnapshot().distance).toBeGreaterThan(550);
  });
});

describe('while recording', () => {
  it('follows the athlete: position, route, start marker and distance', async () => {
    await session.start(OPTS);
    const walk = straightTrack({ speedMps: 3, durationS: 40, intervalS: 2 });

    play(walk);

    const snap = session.getSnapshot();
    expect(snap.lastFix).toEqual(walk[walk.length - 1]);
    expect(snap.startLocation).toEqual([walk[0]?.longitude, walk[0]?.latitude]);
    expect(snap.route.length).toBe(tracking.getLocations().length);
    expect(snap.route[0]).toEqual([walk[0]?.longitude, walk[0]?.latitude]);
    expect(snap.distance).toBeGreaterThan(100);
    expect(snap.polygon).toBeNull();
  });

  it('only draws fixes the tracker actually kept', async () => {
    await session.start(OPTS);
    const walk = straightTrack({ speedMps: 3, durationS: 20, intervalS: 2 });
    play(walk);
    const kept = session.getSnapshot().route.length;

    // inaccurate fix: tracker drops it, so the map must too
    platform.location.emit({
      ...at(walk, -1),
      timestamp: at(walk, 10).timestamp + 99_000,
      accuracy: 80,
    });

    expect(session.getSnapshot().route.length).toBe(kept);
  });

  it('shows the captured territory once the route closes into a loop', async () => {
    await session.start(OPTS);

    play(loopTrack({ radiusM: 60, speedMps: 3, intervalS: 2 }));

    expect(session.getSnapshot().polygon).not.toBeNull();
  });

  it('keeps time moving on tick(), even without new GPS fixes', async () => {
    await session.start(OPTS);

    platform.clock.advance(10_000);
    session.tick();

    expect(session.getSnapshot().duration).toBe(10_000);
  });

  it('tells subscribers about changes, and only until they unsubscribe', async () => {
    const seen: string[] = [];
    const unsubscribe = session.subscribe(() => seen.push(session.getSnapshot().status));

    await session.start(OPTS);
    unsubscribe();
    await session.pause();

    expect(seen).toContain('tracking');
    expect(seen).not.toContain('paused');
  });

  it('hands out the same snapshot until something changes', async () => {
    await session.start(OPTS);

    expect(session.getSnapshot()).toBe(session.getSnapshot());
  });
});

describe('pausing', () => {
  it('stops listening to GPS and the background task, and resumes both', async () => {
    await session.start(OPTS);
    play(straightTrack({ speedMps: 3, durationS: 20, intervalS: 2 }));

    await session.pause();

    expect(session.getSnapshot().status).toBe('paused');
    expect(tracking.getIsTracking()).toBe(false);
    expect(platform.location.activeWatchers).toBe(0);
    expect(platform.background.started).toBe(false);
    expect(platform.haptics.calls).toContain('impactMedium');

    await session.resume();

    expect(session.getSnapshot().status).toBe('tracking');
    expect(tracking.getIsTracking()).toBe(true);
    expect(platform.location.activeWatchers).toBe(1);
    expect(platform.background.started).toBe(true);
  });

  it('auto-pauses when you stand still, keeps listening, and resumes when you move', async () => {
    await session.start({ ...OPTS, autoPause: true });
    const still = (i: number): Location => ({
      ...PUNE,
      timestamp: FAKE_EPOCH_MS + i * 1000,
      accuracy: 5,
    });

    play([0, 1, 2, 3, 4, 5, 6].map(still));

    let snap = session.getSnapshot();
    expect(snap.status).toBe('paused');
    expect(snap.autoPaused).toBe(true);
    // the old screen dropped its GPS watcher here, so it could never notice you moving again
    expect(platform.location.activeWatchers).toBe(1);

    const moved = {
      latitude: PUNE.latitude + 3 / 111_320,
      longitude: PUNE.longitude,
      timestamp: FAKE_EPOCH_MS + 7000,
      accuracy: 5,
    };
    play([moved]);

    snap = session.getSnapshot();
    expect(snap.status).toBe('tracking');
    expect(snap.autoPaused).toBe(false);
  });

  it('auto-pauses on tick() when the GPS goes silent mid-run', async () => {
    await session.start({ ...OPTS, autoPause: true });
    const walk = straightTrack({ speedMps: 3, durationS: 6, intervalS: 1 });
    play(walk);
    expect(session.getSnapshot().status).toBe('tracking');

    platform.clock.set((walk.at(-1)?.timestamp ?? 0) + 10_000);
    session.tick();

    const snap = session.getSnapshot();
    expect(snap.status).toBe('paused');
    expect(snap.autoPaused).toBe(true);
  });
});

describe('background points', () => {
  it('ignores buffered points from a stretch it already recorded live', async () => {
    await session.start(OPTS);
    const walk = straightTrack({ speedMps: 3, durationS: 60, intervalS: 2 });
    play(walk);
    const distanceLive = session.getSnapshot().distance;
    // the OS buffered the same stretch while the app was in the foreground
    for (const i of [5, 10, 15, 20, 25]) platform.background.deliver(at(walk, i));

    await session.syncBackground();

    expect(session.getSnapshot().distance).toBe(distanceLive);
    expect(await platform.background.peek()).toEqual([]);
  });

  it('adds what the app missed while it was in the background', async () => {
    await session.start(OPTS);
    const walk = straightTrack({ speedMps: 3, durationS: 60, intervalS: 2 });
    play(walk.slice(0, 16));
    const before = session.getSnapshot();
    for (const fix of walk.slice(16)) platform.background.deliver(fix);

    await session.syncBackground();

    const after = session.getSnapshot();
    expect(after.distance).toBeGreaterThan(before.distance + 80);
    expect(after.route.length).toBeGreaterThan(before.route.length);
    expect(await platform.background.peek()).toEqual([]);
  });
});

describe('laps', () => {
  // 120 s at 5 m/s is 600 m; the lap is pressed halfway.
  const run = () => straightTrack({ speedMps: 5, durationS: 120, intervalS: 2 });

  it('tells the screen how the lap that was just pressed went', async () => {
    await session.start(OPTS);
    expect(session.getSnapshot().lastLap).toBeNull();
    play(run().slice(0, 31));

    session.lap();

    const lap = session.getSnapshot().lastLap;
    expect(lap?.index).toBe(1);
    expect(lap?.distance).toBeGreaterThan(250);
    expect(lap?.duration).toBeGreaterThan(0);
  });

  it('cuts the run where the athlete pressed lap, and reports every lap at the finish', async () => {
    await session.start(OPTS);
    const fixes = run();
    play(fixes.slice(0, 31));
    session.lap();
    expect(session.getSnapshot().lapCount).toBe(1);
    play(fixes.slice(31));

    const result = await session.finish();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { laps } = result.summary;
    expect(laps).toHaveLength(2);
    expect(laps[0]?.distance).toBeGreaterThan(250);
    expect(laps[0]?.distance).toBeLessThan(320);
    expect((laps[0]?.distance ?? 0) + (laps[1]?.distance ?? 0)).toBeCloseTo(
      result.summary.distance,
      0
    );
    expect((laps[0]?.duration ?? 0) + (laps[1]?.duration ?? 0)).toBe(result.summary.duration);
  });

  it('notes once, at the finish, how many fixes were ignored and why', async () => {
    const recorded: object[] = [];
    ({ tracking, session } = buildSession({}, (counts) => recorded.push(counts)));
    await session.start(OPTS);
    const fixes = run();
    play(fixes.slice(0, 5));
    play([{ ...at(fixes, 5), accuracy: 80 }]);

    await session.finish();

    expect(recorded).toEqual([{ accuracy: 1, speed: 0, acceleration: 0, clock: 0, duplicate: 0 }]);
  });

  it('reports when the run began: the time of its first fix, not of the save', async () => {
    await session.start(OPTS);
    const fixes = run();
    play(fixes);

    const result = await session.finish();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.startedAt).toBe(fixes[0]?.timestamp);
  });

  it('says so when any fix of the run was simulated, and says nothing for a real run', async () => {
    await session.start(OPTS);
    const fixes = run();
    play(fixes.map((fix, i) => (i === 10 ? { ...fix, mocked: true } : fix)));
    const simulated = await session.finish();

    expect(simulated.ok && simulated.summary.mocked).toBe(true);

    ({ tracking, session } = buildSession());
    await session.start(OPTS);
    play(run());
    const real = await session.finish();

    expect(real.ok && real.summary.mocked).toBeFalsy();
  });

  it('has no laps unless lap was pressed', async () => {
    await session.start(OPTS);
    play(run());

    const result = await session.finish();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.laps).toEqual([]);
  });

  it('ignores lap while nothing is being recorded', () => {
    session.lap();

    expect(session.getSnapshot().lapCount).toBe(0);
    expect(platform.haptics.calls).toEqual([]);
  });

  it('gives a tap of feedback when a lap is marked', async () => {
    await session.start(OPTS);
    play(run().slice(0, 10));
    platform.haptics.calls.length = 0;

    session.lap();

    expect(platform.haptics.calls).toContain('impactMedium');
  });

  it('starts the next run with no laps', async () => {
    await session.start(OPTS);
    const fixes = run();
    play(fixes.slice(0, 31));
    session.lap();
    play(fixes.slice(31));
    await session.finish();

    expect(session.getSnapshot().lapCount).toBe(0);
  });
});

describe('splits agree with the distance on a noisy track', () => {
  it('adds up to the headline distance instead of the longer raw zig-zag', async () => {
    await session.start(OPTS);
    // GPS jitter: every other fix lands about 8 m to the side. Raw legs are about 40% longer than the cleaned track.
    const jittery = straightTrack({ speedMps: 4, durationS: 900, intervalS: 2 }).map((fix, i) => ({
      ...fix,
      longitude: fix.longitude + (i % 2 === 0 ? 0 : 0.00007),
    }));
    play(jittery);

    const result = await session.finish();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const total = result.summary.splits.reduce((sum, split) => sum + split.distance, 0);
    expect(Math.abs(total - result.summary.distance) / result.summary.distance).toBeLessThan(0.03);
  });
});

describe('best efforts in the summary', () => {
  it('reports the fastest kilometre of a run that covered one', async () => {
    await session.start(OPTS);
    play(straightTrack({ speedMps: 4, durationS: 600, intervalS: 2 })); // 2.4 km

    const result = await session.finish();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const km = result.summary.bestEfforts.find((e) => e.distance === 1000);
    expect(km?.movingTime).toBeGreaterThan(240_000);
    expect(km?.movingTime).toBeLessThan(260_000);
    expect(result.summary.bestEfforts.find((e) => e.distance === 5000)).toBeUndefined();
  });

  it('leaves best efforts to pace sports: a ride has none', async () => {
    await session.start({ ...OPTS, activityType: 'ride', activityLabel: 'Ride' });
    play(straightTrack({ speedMps: 8, durationS: 300, intervalS: 2 }));

    const result = await session.finish();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.bestEfforts).toEqual([]);
  });
});

describe('finishing', () => {
  it('returns the summary and resets so the next activity starts clean', async () => {
    await session.start(OPTS);
    const walk = straightTrack({ speedMps: 3, durationS: 60, intervalS: 2 });
    play(walk);

    const result = await session.finish();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.distance).toBeGreaterThan(160);
    expect(result.summary.duration).toBe(60_000);
    expect(result.summary.polyline.split(';').length).toBeGreaterThan(10);
    expect(result.summary.territory).toBeNull();
    expect(result.summary.territoryArea).toBe(0);
    // 180 m at 3 m/s: no full kilometre, so one partial split.
    expect(result.summary.splits).toHaveLength(1);
    expect(result.summary.splits[0]?.distance).toBeGreaterThan(160);

    const snap = session.getSnapshot();
    expect(snap.status).toBe('idle');
    expect(snap.route).toEqual([]);
    expect(snap.distance).toBe(0);
    expect(snap.duration).toBe(0);
    expect(snap.polygon).toBeNull();
    expect(platform.location.activeWatchers).toBe(0);
    expect(platform.background.started).toBe(false);
    expect(platform.haptics.calls).toContain('success');
  });

  it('lets the screen sleep when the athlete asked it to', async () => {
    await session.start({ ...OPTS, keepScreenOn: false });
    expect(platform.screenAwake.awake).toBe(false);
    await session.finish();
    expect(platform.screenAwake.awake).toBe(false);
  });

  it('holds the screen awake from start to finish, including while paused', async () => {
    expect(platform.screenAwake.awake).toBe(false);

    await session.start(OPTS);
    expect(platform.screenAwake.awake).toBe(true);

    await session.pause();
    expect(platform.screenAwake.awake).toBe(true);

    await session.resume();
    play(straightTrack({ speedMps: 3, durationS: 60, intervalS: 2 }));
    await session.finish();
    expect(platform.screenAwake.awake).toBe(false);
  });

  it('reports the pace of the last few seconds, and nothing while paused', async () => {
    await session.start(OPTS);
    play(straightTrack({ speedMps: 3, durationS: 60, intervalS: 2 }));

    const { distance, durationMs } = session.getSnapshot().recent;
    expect(durationMs).toBeGreaterThan(5_000);
    expect(durationMs).toBeLessThanOrEqual(15_000);
    expect(distance / (durationMs / 1000)).toBeGreaterThan(2.5);
    expect(distance / (durationMs / 1000)).toBeLessThan(3.5);

    await session.pause();
    expect(session.getSnapshot().recent).toEqual({ distance: 0, durationMs: 0 });
  });

  it('measures the territory a closed loop captured', async () => {
    await session.start(OPTS);
    play(loopTrack({ radiusM: 60, speedMps: 3, intervalS: 2 }));

    const result = await session.finish();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.territory).not.toBeNull();
    // a 60 m-radius circle is about 11,300 m2
    expect(result.summary.territoryArea).toBeGreaterThan(8_000);
    expect(result.summary.territoryArea).toBeLessThan(13_000);
  });

  it('counts background points the app never saw live', async () => {
    await session.start(OPTS);
    const walk = straightTrack({ speedMps: 3, durationS: 60, intervalS: 2 });
    play(walk.slice(0, 16));
    for (const fix of walk.slice(16)) platform.background.deliver(fix);

    const result = await session.finish();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.distance).toBeGreaterThan(160);
  });

  it('turns an accidental tap into a clean idle screen, not a stuck one', async () => {
    await session.start(OPTS);
    platform.clock.advance(2000);

    const result = await session.finish();

    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.error).toMatch(/too short/i);
    expect(session.getSnapshot().status).toBe('idle');
    expect(session.getSnapshot().duration).toBe(0);
    expect(platform.location.activeWatchers).toBe(0);
  });
});

describe('a recording that never moved', () => {
  it('is rejected for a sport measured by GPS: 20 s of standing still is not a run', async () => {
    await session.start(OPTS);
    platform.clock.advance(20_000);

    const result = await session.finish();

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/too short/i);
    expect(session.getSnapshot().status).toBe('idle');
  });

  it('is kept for a sport with no distance: a 20 s yoga session is just time', async () => {
    await session.start({ ...OPTS, activityType: 'yoga', activityLabel: 'Yoga' });
    platform.clock.advance(20_000);

    const result = await session.finish();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.distance).toBe(0);
    expect(result.summary.duration).toBe(20_000);
  });
});

describe('background fixes merged while recording', () => {
  function liveSession() {
    const live = createTrackingService(platform);
    const merged = createTrackingSession({
      tracking: live,
      territory: territoryService,
      location: platform.location,
      background: platform.background,
      motion: platform.motion,
      haptics: platform.haptics,
      speaker: platform.speaker,
      screenAwake: platform.screenAwake,
      ensureLocationPermission: async () => true,
      clock: platform.clock,
      liveBackground: true,
    });
    return { live, merged };
  }

  /** A 60 s walk: the background service gets every 1 s fix, the screen's watcher only every third. */
  async function walk(merged: TrackingSession) {
    const fixes = straightTrack({ speedMps: 1.3, durationS: 60, intervalS: 1 });
    for (const [i, fix] of fixes.entries()) {
      platform.clock.set(fix.timestamp);
      platform.background.deliver(fix);
      if (i % 3 === 0) platform.location.emit(fix);
      merged.tick();
      await Promise.resolve();
      await Promise.resolve();
    }
  }

  it('builds the track from the 1 s background fixes, not only the 3 s foreground ones', async () => {
    const { live, merged } = liveSession();
    await merged.start({ ...OPTS, activityType: 'walk' });
    await walk(merged);
    await merged.pause();

    expect(live.getLocations().length).toBeGreaterThan(40);
  });

  it('keeps them in time order, so none are thrown away as out of date', async () => {
    const { live, merged } = liveSession();
    await merged.start({ ...OPTS, activityType: 'walk' });
    await walk(merged);
    await merged.pause();

    const stamps = live.getLocations().map((l) => l.timestamp);
    expect(stamps).toEqual([...stamps].sort((a, b) => a - b));
    expect(live.getRejections().duplicate).toBeLessThan(5);
  });
});

describe('motion sensors (gyroscope assist)', () => {
  it('runs only while recording with the assist on, and always stops', async () => {
    await session.start({ ...OPTS, useGyroscope: true });
    expect(platform.motion.startCount).toBe(1);

    await session.finish();
    expect(platform.motion.stopCount).toBeGreaterThanOrEqual(1);
  });

  it('stays off when the assist is off', async () => {
    await session.start(OPTS);

    expect(platform.motion.startCount).toBe(0);
  });

  it('carries step-estimated points into the saved track, not only the live map', async () => {
    await session.start({ ...OPTS, useGyroscope: true });
    play(straightTrack({ speedMps: 3, durationS: 8 }));
    expect(tracking.getLocations().length).toBeGreaterThan(0);

    // Steps land between fixes; tick() is what folds them back into the service.
    platform.motion.steps = 5;
    platform.motion.heading = 0;
    platform.motion.moving = true;
    platform.clock.advance(9000);
    session.tick();

    // The point reached the interpolated set, so the service no longer falls
    // back to the GPS-only track when it saves.
    expect(tracking.generateInterpolatedPolyline()).not.toBe(tracking.generatePolyline());
  });
});

describe('motion sensors for auto-pause', () => {
  const PAUSE_OPTS = { ...OPTS, autoPause: true };

  it('run for auto-pause even with the gyroscope assist off', async () => {
    await session.start(PAUSE_OPTS);

    expect(platform.motion.startCount).toBe(1);
  });

  it('stay off for a sport that does not pause by motion', async () => {
    await session.start({ ...PAUSE_OPTS, activityType: 'ride' });

    expect(platform.motion.startCount).toBe(0);
  });

  it('stay off when auto-pause is off', async () => {
    await session.start({ ...OPTS, autoPause: false });

    expect(platform.motion.startCount).toBe(0);
  });

  it('hand every acceleration reading to the tracker, until the recording ends', async () => {
    const received: number[] = [];
    vi.spyOn(tracking, 'addAccelerationSample').mockImplementation((g) => {
      received.push(g);
    });
    await session.start(PAUSE_OPTS);

    platform.motion.emitAcceleration(1.2);
    platform.motion.emitAcceleration(0.9);
    await session.finish();
    platform.motion.emitAcceleration(1.5);

    expect(received).toEqual([1.2, 0.9]);
  });
});

describe('restoring after the app was killed', () => {
  /** A fresh process: new tracker and session, same storage, no live GPS watcher. */
  function relaunch() {
    return buildSession({ location: new FakeLocationSource() });
  }

  async function runAndPersist(): Promise<void> {
    await session.start(OPTS);
    play(straightTrack({ speedMps: 3, durationS: 60, intervalS: 2 }));
    await vi.advanceTimersByTimeAsync(5000);
  }

  it('picks a running session back up and starts listening again', async () => {
    await runAndPersist();
    const second = relaunch();

    await second.session.restore(OPTS);

    const snap = second.session.getSnapshot();
    expect(snap.status).toBe('tracking');
    expect(snap.route.length).toBeGreaterThan(10);
    expect(snap.distance).toBeGreaterThan(100);
    expect(second.deps.location.activeWatchers).toBe(1);
  });

  it('remembers which sport the interrupted run was, whatever the screen defaults to', async () => {
    await session.start({ ...OPTS, activityType: 'ride' });
    play(straightTrack({ speedMps: 3, durationS: 60, intervalS: 2 }));
    await vi.advanceTimersByTimeAsync(5000);
    const second = relaunch();

    await second.session.restore({ ...OPTS, activityType: 'run' });

    expect(second.session.getSnapshot().activityType).toBe('ride');
  });

  it('shows a paused session as paused, not as a blank start screen', async () => {
    await runAndPersist();
    await session.pause();
    const second = relaunch();

    await second.session.restore(OPTS);

    const snap = second.session.getSnapshot();
    expect(snap.status).toBe('paused');
    expect(snap.distance).toBeGreaterThan(100);
    expect(second.deps.location.activeWatchers).toBe(0);
  });

  it('leaves a live session alone when the screen remounts', async () => {
    await session.start(OPTS);
    play(straightTrack({ speedMps: 3, durationS: 20, intervalS: 2 }));
    const live = session.getSnapshot();

    await session.restore(OPTS);

    expect(session.getSnapshot()).toBe(live);
    expect(platform.location.activeWatchers).toBe(1);
  });

  it('stays idle when there is nothing to restore', async () => {
    const second = relaunch();

    await second.session.restore(OPTS);

    expect(second.session.getSnapshot().status).toBe('idle');
  });
});

describe('splits while recording', () => {
  it('lists each finished kilometre as the run goes, and none before the first', async () => {
    await session.start(OPTS);
    // 5 m/s: a kilometre takes 200 s.
    const fixes = straightTrack({ speedMps: 5, durationS: 250, intervalS: 2 });
    play(fixes.filter((f) => f.timestamp - FAKE_EPOCH_MS < 150_000));
    expect(session.getSnapshot().splits).toEqual([]);

    play(fixes.filter((f) => f.timestamp - FAKE_EPOCH_MS >= 150_000));

    const { splits } = session.getSnapshot();
    expect(splits).toHaveLength(1);
    expect(splits[0]?.distance).toBe(1000);
    expect(splits[0]?.movingTime).toBeGreaterThan(190_000);
    expect(splits[0]?.movingTime).toBeLessThan(210_000);
  });
});

describe('audio cues', () => {
  const fixes = () => straightTrack({ speedMps: 5, durationS: 250, intervalS: 2 });

  it('says each finished kilometre aloud when cues are on', async () => {
    await session.start({ ...OPTS, audioCueInterval: 'unit' });

    play(fixes());

    expect(platform.speaker.spoken).toHaveLength(1);
    expect(platform.speaker.spoken[0]).toBe(
      '1 kilometre. Time 3 minutes 20 seconds. Pace 3 minutes 20 seconds per kilometre.'
    );
  });

  it('says the whole time so far on later kilometres, not just that kilometre', async () => {
    await session.start({ ...OPTS, audioCueInterval: 'unit' });

    play(straightTrack({ speedMps: 5, durationS: 450, intervalS: 2 }));

    expect(platform.speaker.spoken[1]).toMatch(/^2 kilometres\. Time 6 minutes 4\d seconds\./);
  });

  it('stays quiet when cues are off', async () => {
    await session.start(OPTS);

    play(fixes());

    expect(platform.speaker.spoken).toEqual([]);
  });

  it('says miles for an imperial athlete', async () => {
    await session.start({
      ...OPTS,
      audioCueInterval: 'unit',
      unitSystem: 'imperial',
      splitMeters: 1609.34,
    });

    play(straightTrack({ speedMps: 5, durationS: 400, intervalS: 2 }));

    expect(platform.speaker.spoken[0]).toMatch(/^1 mile\./);
  });

  it('adds the distance and time at each half kilometre, keeping the pace for whole ones', async () => {
    await session.start({ ...OPTS, audioCueInterval: 'half' });

    play(straightTrack({ speedMps: 5, durationS: 450, intervalS: 2 }));

    const spoken = platform.speaker.spoken;
    expect(spoken).toHaveLength(4);
    expect(spoken[0]).toMatch(/^Distance 0\.5 kilometres\. Time 1 minute 4\d seconds\.$/);
    expect(spoken[1]).toBe(
      '1 kilometre. Time 3 minutes 20 seconds. Pace 3 minutes 20 seconds per kilometre.'
    );
    expect(spoken[2]).toMatch(/^Distance 1\.5 kilometres\. Time 5 minutes( \d+ seconds?)?\.$/);
    expect(spoken[3]).toMatch(/^2 kilometres\. Time 6 minutes 4\d seconds\. Pace /);
  });

  it('says half miles for an imperial athlete', async () => {
    await session.start({
      ...OPTS,
      audioCueInterval: 'half',
      unitSystem: 'imperial',
      splitMeters: METERS_PER_MILE,
    });

    play(straightTrack({ speedMps: 5, durationS: 200, intervalS: 2 }));

    expect(platform.speaker.spoken).toHaveLength(1);
    expect(platform.speaker.spoken[0]).toMatch(/^Distance 0\.5 miles\. Time 2 minutes/);
  });

  it('does not say a half again after a pause and resume', async () => {
    await session.start({ ...OPTS, audioCueInterval: 'half' });
    const track = straightTrack({ speedMps: 5, durationS: 250, intervalS: 2 });

    play(track.slice(0, 70));
    await session.pause();
    await session.resume();
    session.tick();
    play(track.slice(70));

    expect(platform.speaker.spoken).toHaveLength(2);
    expect(platform.speaker.spoken[0]).toMatch(/^Distance 0\.5 kilometres\./);
    expect(platform.speaker.spoken[1]).toMatch(/^1 kilometre\./);
  });
});

describe('spoken actions', () => {
  const fixes = () => straightTrack({ speedMps: 5, durationS: 120, intervalS: 2 });

  it('says what it is doing as the athlete starts, pauses, resumes and stops', async () => {
    await session.start({ ...OPTS, announceActions: true });
    play(fixes().slice(0, 31));
    await session.pause();
    await session.resume();
    await session.finish();

    expect(platform.speaker.spoken).toEqual([
      'Starting run.',
      'Pausing run.',
      'Resuming run.',
      'Stopping run.',
    ]);
  });

  it('reads out a lap when it closes', async () => {
    await session.start({ ...OPTS, announceActions: true });
    play(fixes().slice(0, 31));

    session.lap();

    expect(platform.speaker.spoken.at(-1)).toMatch(
      /^Lap 1\. \d+ minutes?( \d+ seconds?)?\. \d+ metres\.$/
    );
  });

  it('stays quiet when the setting is off', async () => {
    await session.start(OPTS);
    await session.pause();
    await session.resume();
    session.lap();
    await session.finish();

    expect(platform.speaker.spoken).toEqual([]);
  });
});

describe('elevation in the summary', () => {
  /** A straight run that climbs 40 m over its first half and comes back down over the second. */
  const hillyRun = () => {
    const fixes = straightTrack({ speedMps: 3, durationS: 120, intervalS: 2 });
    return fixes.map((fix, i) => {
      const half = fixes.length / 2;
      const altitude = i < half ? 100 + (40 * i) / half : 140 - (40 * (i - half)) / half;
      return { ...fix, altitude, verticalAccuracy: 4 };
    });
  };

  it("reports the climb and descent from the phone's altitude", async () => {
    await session.start(OPTS);
    play(hillyRun());

    const result = await session.finish();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.elevationGain).toBeGreaterThan(30);
    expect(result.summary.elevationGain).toBeLessThan(45);
    expect(result.summary.elevationLoss).toBeGreaterThan(30);
    expect(result.summary.stream?.alt).toBeDefined();
  });

  it('reports none when the phone gave no altitude', async () => {
    await session.start(OPTS);
    play(straightTrack({ speedMps: 3, durationS: 120, intervalS: 2 }));

    const result = await session.finish();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.elevationGain).toBeUndefined();
    expect(result.summary.stream?.alt).toBeUndefined();
  });
});

describe('live climb', () => {
  const climbing = () =>
    straightTrack({ speedMps: 2, durationS: 100, intervalS: 2 }).map((fix, i) => ({
      ...fix,
      altitude: 100 + i * 0.5,
      verticalAccuracy: 3,
    }));

  it('has no climb until the phone gives altitudes', async () => {
    await session.start(OPTS);
    play(straightTrack({ speedMps: 2, durationS: 100, intervalS: 2 }));

    expect(session.getSnapshot().elevationGain).toBeNull();
  });

  it('counts the metres climbed so far while recording', async () => {
    await session.start(OPTS);
    play(climbing());

    const climb = session.getSnapshot().elevationGain;
    expect(climb).not.toBeNull();
    expect(climb).toBeGreaterThanOrEqual(20);
    expect(climb).toBeLessThanOrEqual(25);
  });

  it('is cleared when the recording ends', async () => {
    await session.start(OPTS);
    play(climbing());
    await session.finish();

    expect(session.getSnapshot().elevationGain).toBeNull();
  });
});
