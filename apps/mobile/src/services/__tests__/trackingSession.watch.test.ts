import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FAKE_EPOCH_MS,
  type FakePlatform,
  installFakePlatform,
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

const OPTS: SessionOptions = {
  activityType: 'run',
  activityLabel: 'Run',
  accuracyMode: 'best',
  timeIntervalMs: 1000,
  useGyroscope: false,
  autoPause: false,
  useWatch: true,
};

let platform: FakePlatform;
let session: TrackingSession;

/** Two minutes at 5 m/s: about 600 m by GPS. */
const run = () => straightTrack({ speedMps: 5, durationS: 120, intervalS: 2 });

function play(fixes: Location[]): void {
  platform.location.play(fixes, (fix) => platform.clock.set(fix.timestamp));
}

/** The watch streaming once a second for `seconds`, measuring `mps` and a steady heart rate. */
function stream(seconds: number, mps: number, from = 0): void {
  for (let s = from; s <= seconds; s++) {
    platform.watch.emit({
      t: FAKE_EPOCH_MS + s * 1000,
      heartRate: 140 + (s % 10),
      distance: s * mps,
      calories: s * 0.2,
      cadence: 172,
      power: 260,
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  platform = installFakePlatform();
  platform.watch.currentStatus = 'ready';
  const tracking = createTrackingService(platform);
  session = createTrackingSession({
    tracking,
    territory: territoryService,
    location: platform.location,
    background: platform.background,
    motion: platform.motion,
    haptics: platform.haptics,
    speaker: platform.speaker,
    screenAwake: platform.screenAwake,
    ensureLocationPermission: async () => true,
    clock: platform.clock,
    watch: platform.watch,
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  uninstallFakePlatform();
});

describe('recording with a watch', () => {
  it('starts the watch workout for the sport', async () => {
    await session.start(OPTS);
    expect(platform.watch.calls).toEqual(['start:run']);
    expect(session.getSnapshot().watch?.state).toBe('running');
  });

  it('leaves the watch alone when not asked, or for a sport it does not record', async () => {
    await session.start({ ...OPTS, useWatch: false });
    await session.finish();
    await session.start({ ...OPTS, activityType: 'swim' });
    expect(platform.watch.calls).toEqual([]);
    expect(session.getSnapshot().watch).toBeNull();
  });

  it('carries on with the phone alone when the watch cannot be reached', async () => {
    platform.watch.reachable = false;
    await session.start(OPTS);
    await vi.waitFor(() => expect(session.getSnapshot().watch).toBeNull());
    expect(session.getSnapshot().status).toBe('tracking');
  });

  it('shows the latest heart rate, cadence and power', async () => {
    await session.start(OPTS);
    stream(3, 5);
    expect(session.getSnapshot().watch).toMatchObject({
      state: 'running',
      heartRate: 143,
      cadence: 172,
      power: 260,
    });
  });

  it('pauses and resumes the watch with the phone', async () => {
    await session.start(OPTS);
    await session.pause();
    await session.resume();
    expect(platform.watch.calls).toEqual(['start:run', 'pause', 'resume']);
  });

  it('follows a pause and resume pressed on the watch, without echoing them back', async () => {
    await session.start(OPTS);
    platform.watch.press('paused');
    await vi.waitFor(() => expect(session.getSnapshot().status).toBe('paused'));
    platform.watch.press('running');
    await vi.waitFor(() => expect(session.getSnapshot().status).toBe('tracking'));
    expect(platform.watch.calls).toEqual(['start:run']);
  });

  it('marks the watch disconnected when its readings stop', async () => {
    await session.start(OPTS);
    stream(2, 5);
    vi.advanceTimersByTime(11_000);
    session.tick();
    expect(session.getSnapshot().watch).toEqual({ state: 'disconnected' });
  });
});

describe('the finished recording', () => {
  it('takes heart rate, calories, cadence and power from the watch, and its distance', async () => {
    await session.start(OPTS);
    play(run());
    // The watch measured 8% further than the GPS track.
    stream(120, 5.4);

    const result = await session.finish();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { summary } = result;
    expect(platform.watch.calls.at(-1)).toBe('end');
    expect(summary.recordedWithWatch).toBe(true);
    expect(summary.heartRate).toEqual({ avg: 144, max: 149 });
    expect(summary.caloriesBurned).toBe(24);
    expect(summary.avgPower).toBe(260);
    expect(summary.stream?.cadence?.spm[0]).toBe(172);
    expect(summary.stream?.heartRate?.bpm.length).toBe(121);
    expect(summary.distance).toBeCloseTo(648, -1);
    const splitTotal = summary.splits.reduce((sum, s) => sum + s.distance, 0);
    expect(splitTotal).toBeCloseTo(summary.distance, -1);
  });

  it('keeps the GPS distance when the watch dropped out for most of the run', async () => {
    await session.start(OPTS);
    play(run());
    stream(20, 5.4);

    const result = await session.finish();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.distance).toBeLessThan(620);
    // Its heart rate still counts for the stretch it was there.
    expect(result.summary.heartRate?.max).toBe(149);
  });
});
