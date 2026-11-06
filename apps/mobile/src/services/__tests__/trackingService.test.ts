import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  at,
  type FakePlatform,
  installFakePlatform,
  straightTrack,
  uninstallFakePlatform,
} from '@/platform/fakes';
import { createTrackingService, type TrackingService } from '@/services/trackingService';
import type { Location } from '@/types';
import { haversineDistance, rejectOutliers, smoothLocations } from '@/utils/geo';

let service: TrackingService;

const TRACKING_KEY = '@stryde/tracking';
const BASE_MS = new Date('2026-01-01T00:00:00.000Z').getTime();
const METERS_PER_DEG = 111320;
const LAT = 48.85;
const LNG = 2.294;

function latOffset(meters: number): number {
  return meters / METERS_PER_DEG;
}

function loc(timestampOffset: number, latitude: number, longitude: number): Location {
  return { latitude, longitude, timestamp: BASE_MS + timestampOffset, accuracy: 5 };
}

function feed(...locations: Location[]): void {
  for (const location of locations) {
    platform.clock.set(location.timestamp);
    service.addLocation(location);
  }
}

function feedSlowUntilPaused(): void {
  for (let i = 0; i <= 6; i++) {
    feed(loc(i * 1000, LAT, LNG));
  }
}

let platform: FakePlatform;

function lastPersisted(): string | undefined {
  return platform.storage.peek(TRACKING_KEY);
}

beforeEach(async () => {
  platform = installFakePlatform();
  platform.clock.set(BASE_MS);
  vi.useFakeTimers();
  service = createTrackingService(platform);
  vi.clearAllMocks();
  service.setAutoPauseEnabled(true);
  service.setUseGyroscope(false);
  await service.startTracking();
});

afterEach(() => {
  uninstallFakePlatform();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TrackingService auto-pause', () => {
  it('never pauses while moving at >= 1 m/s', () => {
    const pauseSpy = vi.spyOn(service, 'pauseTracking');
    const fixes: Location[] = [];
    for (let i = 0; i < 10; i++) {
      fixes.push(loc(i * 1000, LAT + i * latOffset(5), LNG));
    }
    feed(...fixes);

    expect(pauseSpy).not.toHaveBeenCalled();
    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });

  it('pauses after ~5s of consecutive fixes below 1 m/s', () => {
    const pauseSpy = vi.spyOn(service, 'pauseTracking');
    feedSlowUntilPaused();

    expect(pauseSpy).toHaveBeenCalled();
    expect(service.getIsAutoPaused()).toBe(true);
    expect(service.getIsTracking()).toBe(false);
  });

  it('does not pause on a single sub-1 m/s blip', () => {
    const pauseSpy = vi.spyOn(service, 'pauseTracking');
    for (let i = 0; i < 4; i++) {
      feed(loc(i * 1000, LAT + i * latOffset(5), LNG));
    }
    feed(loc(4 * 1000, LAT + 3 * latOffset(5), LNG));
    for (let i = 5; i < 10; i++) {
      feed(loc(i * 1000, LAT + i * latOffset(5), LNG));
    }

    expect(pauseSpy).not.toHaveBeenCalled();
    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });

  it('does not pause while disabled, and disabling aborts an in-progress hold', () => {
    const pauseSpy = vi.spyOn(service, 'pauseTracking');
    feed(loc(0, LAT, LNG), loc(1000, LAT, LNG), loc(2000, LAT, LNG));

    service.setAutoPauseEnabled(false);

    for (let i = 3; i <= 12; i++) {
      feed(loc(i * 1000, LAT, LNG));
    }

    expect(pauseSpy).not.toHaveBeenCalled();
    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });

  it('freezes duration while auto-paused', () => {
    feedSlowUntilPaused();
    expect(service.getIsAutoPaused()).toBe(true);

    const atPause = service.getDuration();
    platform.clock.set(BASE_MS + 30_000);

    expect(service.getDuration()).toBe(atPause);
  });

  it('resumes only when speed > 1 m/s and displacement >= 2m', () => {
    feedSlowUntilPaused();
    expect(service.getIsAutoPaused()).toBe(true);

    feed(loc(6500, LAT + latOffset(1.5), LNG));
    expect(service.getIsAutoPaused()).toBe(true);
    expect(service.getIsTracking()).toBe(false);

    feed(loc(7000, LAT + latOffset(3), LNG));
    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });

  it('resumes on the first fix that shows running pace, however long the pause lasted', () => {
    feedSlowUntilPaused();
    expect(service.getIsAutoPaused()).toBe(true);
    // A minute standing still, a fix every second.
    for (let t = 8000; t <= 60_000; t += 1000) feed(loc(t, LAT, LNG));
    expect(service.getIsAutoPaused()).toBe(true);

    // 3 m in one second. Averaged over the whole pause this looked like 0.05 m/s and never resumed.
    feed(loc(61_000, LAT + latOffset(3), LNG));

    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });

  it('stays paused on high speed but < 2m displacement', () => {
    feedSlowUntilPaused();
    expect(service.getIsAutoPaused()).toBe(true);

    feed(loc(6500, LAT + latOffset(1.8), LNG));
    expect(service.getIsAutoPaused()).toBe(true);
    expect(service.getIsTracking()).toBe(false);
  });

  it('manual resume wins over auto-pause', async () => {
    feedSlowUntilPaused();
    expect(service.getIsAutoPaused()).toBe(true);

    await service.resumeTracking();

    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });

  it('manual pause clears auto-pause state', async () => {
    feedSlowUntilPaused();
    expect(service.getIsAutoPaused()).toBe(true);

    await service.pauseTracking();

    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(false);
  });

  it('persists and restores auto-pause state', async () => {
    feedSlowUntilPaused();
    expect(service.getIsAutoPaused()).toBe(true);

    const persisted = lastPersisted();
    expect(persisted).toBeDefined();
    const parsed = JSON.parse(persisted ?? '{}') as {
      autoPaused: boolean;
      pauseLocation: Location;
    };
    expect(parsed.autoPaused).toBe(true);
    expect(parsed.pauseLocation.latitude).toBe(LAT);
    expect(parsed.pauseLocation.timestamp).toBe(BASE_MS + 6000);

    await service.startTracking();
    expect(service.getIsAutoPaused()).toBe(false);

    await platform.storage.setItem(TRACKING_KEY, persisted ?? '');
    await service.restoreSession();
    expect(service.getIsAutoPaused()).toBe(true);

    feed(loc(7000, LAT + latOffset(3), LNG));
    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });
});

describe('TrackingService ordering', () => {
  // The background task buffers fixes for the whole run; replaying that buffer
  // into a session that already holds the same stretch used to walk the route
  // backwards and inflate distance.
  it('ignores fixes older than the newest one it has seen', () => {
    const track = straightTrack({ speedMps: 3, durationS: 60, intervalS: 2, startTime: BASE_MS });
    for (const fix of track) feed(fix);
    const distanceBefore = service.getDistance();
    const countBefore = service.getLocations().length;

    for (const i of [5, 10, 15, 20, 25]) service.addLocation(at(track, i));

    expect(service.getLocations()).toHaveLength(countBefore);
    expect(service.getDistance()).toBe(distanceBefore);
  });

  it('does not let a stale fix feed auto-pause', () => {
    service.setAutoPauseEnabled(true);
    const track = straightTrack({ speedMps: 3, durationS: 30, intervalS: 2, startTime: BASE_MS });
    for (const fix of track) feed(fix);

    // same instant as an earlier fix, no movement: looks like "standing still" if misread
    for (let i = 0; i < 10; i++) service.addLocation(at(track, 3));

    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });
});

describe('TrackingService too-short activities', () => {
  it('rejects an accidental start: almost no distance in under 5 seconds', async () => {
    platform.clock.advance(3000);

    const result = await service.stopTracking();

    expect(result.success).toBe(false);
  });

  it('keeps an activity that ran 5 seconds or more, even if it barely moved', async () => {
    platform.clock.advance(6000);

    expect((await service.stopTracking()).success).toBe(true);
  });

  it('discards the rejected attempt completely so nothing stale is restored later', async () => {
    feed(loc(0, LAT, LNG));
    platform.clock.advance(2000);

    await service.stopTracking();

    expect(service.getStartTime()).toBeNull();
    expect(service.getLocations()).toEqual([]);
    expect(platform.storage.peek(TRACKING_KEY)).toBeUndefined();
  });
});

describe('TrackingService restore after the app was killed', () => {
  async function relaunchAfter(ms: number): Promise<TrackingService> {
    platform.clock.advance(ms);
    const relaunched = createTrackingService(platform);
    await relaunched.restoreSession();
    return relaunched;
  }

  it('counts a quick relaunch as active time', async () => {
    const relaunched = await relaunchAfter(30_000);

    expect(relaunched.getIsTracking()).toBe(true);
    expect(relaunched.getDuration()).toBe(30_000);
  });

  it('does not count hours of being dead as activity', async () => {
    const relaunched = await relaunchAfter(2 * 60 * 60 * 1000);

    // at most one minute of the gap is credited as active
    expect(relaunched.getDuration()).toBe(60_000);
  });
});

describe('TrackingService speed limits', () => {
  it('measures a ride at cycling speed instead of discarding it as a run', () => {
    service.setMaxSpeed(50);
    // 10 m/s (36 km/h), a fix every 2 s for a minute
    const ride = straightTrack({ speedMps: 10, durationS: 60, intervalS: 2, startTime: BASE_MS });
    for (const fix of ride) feed(fix);

    expect(service.getLocations()).toHaveLength(ride.length);
    expect(service.getDistance()).toBeGreaterThan(550);
    expect(service.generatePolyline().split(';').length).toBeGreaterThan(20);
  });
});

describe('TrackingService signal-loss watchdog', () => {
  const SILENT_MS = 10_000;

  function moveFor(seconds: number): void {
    const fixes: Location[] = [];
    for (let i = 0; i <= seconds; i++) fixes.push(loc(i * 1000, LAT + i * latOffset(5), LNG));
    feed(...fixes);
  }

  it('auto-pauses once no fix has arrived for 10 s while recording', () => {
    moveFor(3);
    platform.clock.set(BASE_MS + 3000 + SILENT_MS);
    service.checkSignalLoss();

    expect(service.getIsAutoPaused()).toBe(true);
    expect(service.getIsTracking()).toBe(false);
  });

  it('waits out a shorter silence', () => {
    moveFor(3);
    platform.clock.set(BASE_MS + 3000 + SILENT_MS - 1);
    service.checkSignalLoss();

    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });

  it('does nothing before the first fix, so a slow GPS lock is not a pause', () => {
    platform.clock.set(BASE_MS + 60_000);
    service.checkSignalLoss();

    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });

  it('does nothing when auto-pause is off', () => {
    service.setAutoPauseEnabled(false);
    moveFor(3);
    platform.clock.set(BASE_MS + 3000 + SILENT_MS);
    service.checkSignalLoss();

    expect(service.getIsAutoPaused()).toBe(false);
  });

  it('resumes when the signal returns with the athlete having moved on', () => {
    moveFor(3);
    platform.clock.set(BASE_MS + 3000 + SILENT_MS);
    service.checkSignalLoss();
    expect(service.getIsAutoPaused()).toBe(true);

    feed(loc(20_000, LAT + latOffset(15 + 40), LNG));

    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });
});

describe('TrackingService fix classification', () => {
  it('does not count a 672 m jump at 24 m accuracy after a quiet spell, when the chip says it is standing still', async () => {
    service.setAutoPauseEnabled(false);
    feed(loc(0, LAT, LNG), loc(5_000, LAT + latOffset(15), LNG));
    const before = service.getDistance();

    feed({ ...loc(125_000, LAT + latOffset(15 + 672), LNG), accuracy: 24, speed: 0.4 });

    expect(service.getDistance()).toBe(before);
    expect(service.getLocations()).toHaveLength(2);
  });

  it('keeps counting once the track really has moved on, after several jumps in a row', () => {
    service.setAutoPauseEnabled(false);
    feed(loc(0, LAT, LNG));
    for (let i = 1; i <= 6; i++) {
      feed(loc(i * 5_000, LAT + latOffset(3000 + i * 10), LNG));
    }

    expect(service.getLocations().length).toBeGreaterThan(1);
  });
});

describe('TrackingService auto-pause on a ride', () => {
  beforeEach(async () => {
    await service.stopTracking();
    await service.startTracking('ride');
  });

  it('keeps going on a slow climb at 3 km/h, which would pause a runner', () => {
    const fixes: Location[] = [];
    for (let i = 0; i < 25; i++) fixes.push(loc(i * 1000, LAT + i * latOffset(0.8), LNG));
    feed(...fixes);

    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });

  it('pauses after 10 s standing still, not before', () => {
    for (let i = 0; i <= 8; i++) feed(loc(i * 1000, LAT, LNG));
    expect(service.getIsAutoPaused()).toBe(false);

    for (let i = 9; i <= 11; i++) feed(loc(i * 1000, LAT, LNG));
    expect(service.getIsAutoPaused()).toBe(true);
  });

  it('resumes at a walking-pace creep of 0.4 m/s once it has moved 2 m', () => {
    for (let i = 0; i <= 11; i++) feed(loc(i * 1000, LAT, LNG));
    expect(service.getIsAutoPaused()).toBe(true);

    feed(loc(16_000, LAT + latOffset(2.5), LNG));

    expect(service.getIsAutoPaused()).toBe(false);
  });
});

describe('TrackingService auto-pause on a hike', () => {
  const slowClimb = () =>
    Array.from({ length: 25 }, (_, i) => loc(i * 1000, LAT + i * latOffset(0.8), LNG));

  it('keeps going on a slow climb at about 3 km/h, like a ride', async () => {
    await service.stopTracking();
    await service.startTracking('hike');

    feed(...slowClimb());

    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });

  it('still pauses a runner at that pace, which is a stop for them', async () => {
    await service.stopTracking();
    await service.startTracking('run');

    feed(...slowClimb());

    expect(service.getIsAutoPaused()).toBe(true);
  });
});

describe('TrackingService motion-based auto-pause', () => {
  /** Streams 20 Hz acceleration for `seconds`, moving the fake clock with it. */
  function shake(seconds: number, amplitudeG: number) {
    for (let t = 0; t < seconds * 1000; t += 50) {
      platform.clock.advance(50);
      service.addAccelerationSample(
        1 + amplitudeG * Math.sin(2 * Math.PI * 2.5 * (platform.clock.now() / 1000))
      );
    }
  }

  /** Like `shake`, with the GPS chip reporting `speed` once a second, as a real one does. */
  function shakeWithGps(seconds: number, amplitudeG: number, speed: number) {
    let northM = 6;
    for (let s = 0; s < seconds; s++) {
      shake(1, amplitudeG);
      northM += speed;
      service.addLocation({
        ...loc(platform.clock.now() - BASE_MS, LAT + latOffset(northM), LNG),
        speed,
      });
    }
  }

  async function startRun(type = 'run') {
    await service.startTracking(type);
    platform.clock.set(BASE_MS);
    // A fix the athlete is clearly running with: the chip says 3 m/s.
    feed({ ...loc(0, LAT, LNG), speed: 3 }, { ...loc(2_000, LAT + latOffset(6), LNG), speed: 3 });
  }

  it('pauses when the phone goes still, but only once the athlete has been going a while', async () => {
    await startRun();
    shake(2, 0.4);
    expect(service.getIsAutoPaused()).toBe(false);

    shake(20, 0.4);
    // The chip has slowed to a walk's worth by now.
    feed({ ...loc(platform.clock.now() - BASE_MS + 1000, LAT + latOffset(7), LNG), speed: 0.2 });
    shake(8, 0.004);

    expect(service.getIsAutoPaused()).toBe(true);
    expect(service.getIsTracking()).toBe(false);
  });

  it('does not pause when the chip says the athlete is moving fast, as with a phone clamped to a bike', async () => {
    await startRun();
    shakeWithGps(20, 0.4, 3);
    shakeWithGps(10, 0.004, 3);

    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });

  it('leaves rides to the GPS-based rules', async () => {
    await startRun('ride');
    shake(20, 0.4);
    feed({ ...loc(platform.clock.now() - BASE_MS + 1000, LAT + latOffset(7), LNG), speed: 0.2 });
    shake(10, 0.004);

    expect(service.getIsAutoPaused()).toBe(false);
  });

  it('does nothing while auto-pause is off', async () => {
    service.setAutoPauseEnabled(false);
    await startRun();
    shake(20, 0.4);
    feed({ ...loc(platform.clock.now() - BASE_MS + 1000, LAT + latOffset(7), LNG), speed: 0.2 });
    shake(10, 0.004);

    expect(service.getIsAutoPaused()).toBe(false);
  });

  it('resumes when the athlete starts moving again', async () => {
    await startRun();
    shake(20, 0.4);
    feed({ ...loc(platform.clock.now() - BASE_MS + 1000, LAT + latOffset(7), LNG), speed: 0.2 });
    shake(8, 0.004);
    expect(service.getIsAutoPaused()).toBe(true);

    shake(3, 0.4);

    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });

  it('does not resume a pause the athlete made by hand just because the phone shakes', async () => {
    await startRun();
    shake(20, 0.4);
    await service.pauseTracking();

    shake(5, 0.4);

    expect(service.getIsTracking()).toBe(false);
  });
});

describe('TrackingService distance', () => {
  /** Cleaning the whole track and adding up its legs: what the live figure must always equal. */
  function fullDistance(points: Location[], limitKmh: number): number {
    const cleaned = smoothLocations(rejectOutliers(points, { maxSpeedMs: limitKmh / 3.6 }));
    let total = 0;
    for (let i = 1; i < cleaned.length; i++) {
      const a = cleaned[i - 1] as Location;
      const b = cleaned[i] as Location;
      total += haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude);
    }
    return total;
  }

  it('equals cleaning the whole track at every step of a run, including a jump and a bad fix', async () => {
    await service.startTracking('run');
    const track = straightTrack({ speedMps: 3, durationS: 120, intervalS: 2, startTime: BASE_MS });
    track[20] = { ...(track[20] as Location), latitude: LAT + 0.01 };
    track[30] = { ...(track[30] as Location), accuracy: 80 };

    for (const fix of track) {
      feed(fix);
      expect(service.getDistance()).toBeCloseTo(fullDistance(service.getLocations(), 25), 6);
    }
  });

  it('carries on correctly after the session is restored in a new service', async () => {
    await service.startTracking('run');
    const track = straightTrack({ speedMps: 3, durationS: 60, intervalS: 2, startTime: BASE_MS });
    for (const fix of track.slice(0, 20)) feed(fix);
    service.getDistance();
    await vi.advanceTimersByTimeAsync(5000);

    const relaunched = createTrackingService(platform);
    await relaunched.restoreSession();
    for (const fix of track.slice(20)) {
      platform.clock.set(fix.timestamp);
      relaunched.addLocation(fix);
    }

    expect(relaunched.getDistance()).toBeCloseTo(fullDistance(relaunched.getLocations(), 25), 6);
  });
});

describe('TrackingService resume after an auto-pause', () => {
  it('charges the first resumed segment only the real step off, not the wander while paused', () => {
    const walk = straightTrack({ speedMps: 2, durationS: 20, intervalS: 2, startTime: BASE_MS });
    for (const fix of walk) feed(fix);
    const parked = at(walk, -1);
    for (let t = 1; t <= 6; t++) feed({ ...parked, timestamp: parked.timestamp + t * 1000 });
    expect(service.getIsAutoPaused()).toBe(true);
    const recorded = service.getLocations().length;

    const eastOffset = (m: number) =>
      parked.longitude + m / (METERS_PER_DEG * Math.cos((parked.latitude * Math.PI) / 180));
    feed({ ...parked, longitude: eastOffset(1.5), timestamp: parked.timestamp + 7_000 });
    expect(service.getIsAutoPaused()).toBe(true);
    expect(service.getLocations()).toHaveLength(recorded);

    const step = {
      ...parked,
      latitude: parked.latitude + latOffset(4.5),
      timestamp: parked.timestamp + 9_000,
    };
    feed(step);
    expect(service.getIsAutoPaused()).toBe(false);

    const [last, first] = [at(service.getLocations(), -1), at(service.getLocations(), -2)];
    expect(last).toEqual(step);
    expect(
      haversineDistance(first.latitude, first.longitude, last.latitude, last.longitude)
    ).toBeLessThan(5);
  });
});

describe('TrackingService rejection telemetry', () => {
  beforeEach(() => service.setAutoPauseEnabled(false));

  it('starts a session with every count at zero', () => {
    expect(service.getRejections()).toEqual({
      accuracy: 0,
      speed: 0,
      acceleration: 0,
      clock: 0,
      duplicate: 0,
    });
  });

  it('counts a poor-accuracy fix, an unset-clock fix and a repeat separately', () => {
    feed(loc(0, LAT, LNG));
    service.addLocation({ ...loc(5_000, LAT + latOffset(10), LNG), accuracy: 45 });
    service.addLocation({ ...loc(6_000, LAT + latOffset(10), LNG), timestamp: 86_400_000 });
    feed(loc(1_000, LAT, LNG));
    feed(loc(2_000, LAT + latOffset(1), LNG));

    expect(service.getRejections()).toMatchObject({ accuracy: 1, clock: 1, duplicate: 2 });
  });

  it('counts a teleport as a speed rejection', () => {
    feed(loc(0, LAT, LNG), loc(5_000, LAT + latOffset(10), LNG));
    feed(loc(10_000, LAT + latOffset(5000), LNG));

    expect(service.getRejections().speed).toBe(1);
  });

  it('forgets the counts when a new session starts', async () => {
    feed(loc(0, LAT, LNG));
    service.addLocation({ ...loc(5_000, LAT, LNG), accuracy: 99 });
    await service.startTracking();

    expect(service.getRejections().accuracy).toBe(0);
  });
});

describe('TrackingService on a walk', () => {
  /** A walk north at `speed` m/s with a fix each second and two steps per second on the pedometer. */
  function walk(seconds: number, speed = 1.3, fromS = 0) {
    for (let s = fromS; s < fromS + seconds; s++) {
      platform.motion.steps = s * 2;
      feed(loc(s * 1000, LAT + latOffset(s * speed), LNG));
    }
  }

  beforeEach(async () => {
    service.setUseGyroscope(true);
    service.setMaxSpeed(10);
    await service.stopTracking();
    await service.startTracking('walk');
  });

  it('adds no step-estimated points while fixes keep coming', () => {
    walk(60);
    platform.motion.steps += 2;
    platform.clock.advance(500);

    expect(service.generateInterpolatedPoint()).toBeNull();
  });

  it('keeps the distance at walking pace with the step assist on', () => {
    walk(120);
    for (let i = 0; i < 3; i++) {
      const point = service.generateInterpolatedPoint();
      if (point) service.addInterpolatedLocation(point);
    }

    const perSecond = service.getInterpolatedDistance() / 119;
    expect(perSecond).toBeGreaterThan(1.1);
    expect(perSecond).toBeLessThan(1.5);
  });

  it('fills a GPS gap with the steps taken since the last fix, in the direction of travel', () => {
    walk(60);
    const lastFix = at(service.getLocations(), -1);
    platform.motion.steps += 10;
    platform.clock.advance(9_000);

    const point = service.generateInterpolatedPoint();
    if (!point) throw new Error('expected a step-estimated point');
    const moved = haversineDistance(
      lastFix.latitude,
      lastFix.longitude,
      point.latitude,
      point.longitude
    );
    // Ten steps at the calibrated ~0.65 m, not the whole walk's running total of steps.
    expect(moved).toBeGreaterThan(4);
    expect(moved).toBeLessThan(10);
    expect(point.latitude).toBeGreaterThan(lastFix.latitude);
  });

  it('adds no step-estimated points indoors, where fixes wander inside their error circles', () => {
    for (let s = 0; s < 30; s++) {
      platform.motion.steps = s * 2;
      const wobble = s % 2 === 0 ? 4 : -4;
      feed({ ...loc(s * 1000, LAT + latOffset(wobble), LNG), accuracy: 20 });
    }
    platform.motion.steps += 10;
    platform.clock.advance(9_000);

    expect(service.generateInterpolatedPoint()).toBeNull();
  });

  it('swaps a rough first fix for a sharper one nearby instead of counting the gap as distance', () => {
    feed({ ...loc(0, LAT, LNG), accuracy: 28 });
    feed({ ...loc(3_000, LAT + latOffset(20), LNG), accuracy: 8 });

    expect(service.getLocations()).toHaveLength(1);
    expect(service.getLocations()[0]?.accuracy).toBe(8);
    expect(service.getDistance()).toBe(0);
  });

  it('counts the steps since the last fix, no faster than the sport allows', () => {
    walk(30);
    platform.clock.advance(2_000);
    const before = service.getInterpolatedStepDistance();
    platform.motion.steps += 4;
    const fourSteps = service.getInterpolatedStepDistance() - before;
    expect(fourSteps).toBeGreaterThan(2);
    expect(fourSteps).toBeLessThan(4);

    platform.motion.steps += 200;
    const sinceFixS = (platform.clock.now() - at(service.getLocations(), -1).timestamp) / 1000;
    expect(service.getInterpolatedStepDistance()).toBeCloseTo(sinceFixS * (10 / 3.6), 5);
  });

  it('does not pause a slow walk that is still taking steps', () => {
    walk(30, 0.9);
    expect(service.getIsAutoPaused()).toBe(false);
  });

  it('does not motion-pause a walker holding the phone steady while the pedometer counts steps', () => {
    walk(15);
    for (let t = 0; t < 10_000; t += 50) {
      platform.clock.advance(50);
      platform.motion.steps += t % 500 === 0 ? 1 : 0;
      service.addAccelerationSample(1.001);
    }
    expect(service.getIsAutoPaused()).toBe(false);
  });
});
