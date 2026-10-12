import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeClock,
  type FakePlatform,
  installFakePlatform,
  loopTrack,
  SequentialIds,
  straightTrack,
  uninstallFakePlatform,
} from '@/platform/fakes';
import { FakeActivityChain, FakePhotoUploader, MemoryPostRunStore } from '@/services/fakes/postRun';
import { type PostRunInput, savePostRun } from '@/services/postRun';
import { territoryService } from '@/services/territoryService';
import { createTrackingService } from '@/services/trackingService';
import { createTrackingSession, type SessionOptions } from '@/services/trackingSession';
import type { Location } from '@/types';
import {
  clearRecordedRuns,
  FINISHED_RUN_KEY,
  peekRecordedRun,
  restoreRecordedRuns,
  setRecordedRunStorage,
  stashRecordedRun,
} from '@/utils/recordedRunHandoff';
import { recordedRunParams } from '@/utils/recordedRunParams';

/**
 * The core workflow across its layers: a recorded track, the session that measures it, the save
 * handoff and the post-run pipeline that writes it. Only the phone (GPS, storage) and the chain are
 * fakes, so these fail when the pieces stop fitting together, which no single-layer test notices.
 */

const OPTS: SessionOptions = {
  activityType: 'run',
  activityLabel: 'Run',
  accuracyMode: 'best',
  timeIntervalMs: 1000,
  useGyroscope: false,
  autoPause: false,
};

let platform: FakePlatform;
let chain: FakeActivityChain;
let store: MemoryPostRunStore;

function newSession() {
  const tracking = createTrackingService(platform);
  return createTrackingSession({
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
  });
}

const play = (fixes: Location[]) =>
  platform.location.play(fixes, (fix) => platform.clock.set(fix.timestamp));

/** What the Save screen does with the run it was handed: read the params and write the activity. */
async function saveFromParams(params: Record<string, string>) {
  const input: PostRunInput = {
    title: 'Morning Run',
    description: '',
    activityType: 'run',
    distance: Number(params.distance),
    duration: Number(params.duration),
    polyline: params.polyline ?? '',
    splits: JSON.parse(params.splits ?? '[]'),
    territory: params.territory ? JSON.parse(params.territory) : null,
    territoryArea: Number(params.territoryArea ?? 0),
    photos: [],
    privacy: 'everyone',
    isManual: false,
    startedAt: params.startedAt ? Number(params.startedAt) : undefined,
  };
  return savePostRun(input, {
    clock: new FakeClock(),
    ids: new SequentialIds(),
    userId: '0xathlete',
    store,
    uploader: new FakePhotoUploader(),
    chain,
    isVerified: () => true,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  platform = installFakePlatform();
  chain = new FakeActivityChain();
  store = new MemoryPostRunStore();
  clearRecordedRuns();
  setRecordedRunStorage(platform.storage);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  uninstallFakePlatform();
});

describe('record, finish, save', () => {
  it('writes the activity the athlete recorded, with the distance and time the session measured', async () => {
    const session = newSession();
    await session.start(OPTS);
    play(straightTrack({ speedMps: 4, durationS: 600, intervalS: 2 })); // 2.4 km in 10 minutes

    const result = await session.finish();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const params = peekRecordedRun(stashRecordedRun(recordedRunParams(result.summary, 'run')));
    expect(params).toBeDefined();

    const saved = await saveFromParams(params as Record<string, string>);

    expect(saved.activity.distance).toBeGreaterThan(2300);
    expect(saved.activity.distance).toBeLessThan(2500);
    expect(saved.activity.duration).toBe(result.summary.duration);
    expect(chain.methods).toContain('recordActivity');
    expect(store.activities.get(saved.activity.id)?.distance).toBe(saved.activity.distance);
  });

  it('claims territory for a run that closes on itself, and none for a straight line', async () => {
    const loop = newSession();
    await loop.start(OPTS);
    play(loopTrack({ radiusM: 60, speedMps: 4, intervalS: 2 }));
    const loopResult = await loop.finish();
    expect(loopResult.ok && loopResult.summary.territoryArea).toBeGreaterThan(0);

    const line = newSession();
    await line.start(OPTS);
    play(straightTrack({ speedMps: 4, durationS: 300, intervalS: 2 }));
    const lineResult = await line.finish();
    expect(lineResult.ok && lineResult.summary.territoryArea).toBe(0);
  });

  it('refuses a recording that never moved, and nothing is saved', async () => {
    const session = newSession();
    await session.start(OPTS);
    play(straightTrack({ speedMps: 0, durationS: 60, intervalS: 2 }));

    const result = await session.finish();

    expect(result.ok).toBe(false);
    expect(store.activities.size).toBe(0);
    expect(chain.calls).toHaveLength(0);
  });

  it('keeps the splits consistent with the distance on a noisy track (cleaned, not raw)', async () => {
    const session = newSession();
    await session.start(OPTS);
    const jittery = straightTrack({ speedMps: 4, durationS: 900, intervalS: 2 }).map((fix, i) => ({
      ...fix,
      longitude: fix.longitude + (i % 2 === 0 ? 0 : 0.00007),
    }));
    play(jittery);

    const result = await session.finish();

    if (!result.ok) throw new Error('finish failed');
    const total = result.summary.splits.reduce((sum, s) => sum + s.distance, 0);
    expect(Math.abs(total - result.summary.distance) / result.summary.distance).toBeLessThan(0.03);
  });
});

describe('the app is killed on the Save screen', () => {
  it('offers the finished run on the next launch and saves it intact', async () => {
    const session = newSession();
    await session.start(OPTS);
    play(straightTrack({ speedMps: 4, durationS: 600, intervalS: 2 }));
    const result = await session.finish();
    if (!result.ok) throw new Error('finish failed');
    const id = stashRecordedRun(recordedRunParams(result.summary, 'run'));
    await vi.advanceTimersByTimeAsync(0);
    expect(await platform.storage.getItem(FINISHED_RUN_KEY)).not.toBeNull();

    clearRecordedRuns(); // the process dies: memory is gone, storage is not

    const restoredId = await restoreRecordedRuns();
    expect(restoredId).toBe(id);
    const saved = await saveFromParams(peekRecordedRun(id as string) as Record<string, string>);
    expect(saved.activity.distance).toBeGreaterThan(2300);
    expect(chain.methods).toContain('recordActivity');
  });
});
