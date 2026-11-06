import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';
import type { HealthWorkout } from '@/platform/ports';

const { useHealthStore } = await import('@/stores/healthStore');
const { AUTO_SYNC_MIN_GAP_MS, autoSyncOnce, describeAutoSync, shouldSyncNow } = await import(
  '@/services/healthSync'
);

const gate = {
  enabled: true,
  hasAccess: true,
  lastAttemptAt: null,
  now: 10_000_000,
  minGapMs: AUTO_SYNC_MIN_GAP_MS,
  inFlight: false,
};

describe('shouldSyncNow', () => {
  it('syncs when on, allowed and never tried', () => {
    expect(shouldSyncNow(gate)).toBe(true);
  });

  it.each([
    ['off', { enabled: false }],
    ['no access', { hasAccess: false }],
    ['already running', { inFlight: true }],
    ['tried a moment ago', { lastAttemptAt: gate.now - 60_000 }],
  ])('does not sync when %s', (_, patch) => {
    expect(shouldSyncNow({ ...gate, ...patch })).toBe(false);
  });

  it('syncs once the gap has passed', () => {
    expect(shouldSyncNow({ ...gate, lastAttemptAt: gate.now - AUTO_SYNC_MIN_GAP_MS })).toBe(true);
  });
});

const runAt = (now: number): HealthWorkout => ({
  id: 'w1',
  sport: 'run',
  startTime: now - 3_600_000,
  endTime: now - 1_800_000,
  distanceM: 5000,
});

describe('autoSyncOnce', () => {
  let platform: ReturnType<typeof installFakePlatform>;
  beforeEach(() => {
    platform = installFakePlatform();
    platform.health.access = true;
    platform.health.workouts = [runAt(platform.clock.now())];
    useHealthStore.getState().reset();
    useHealthStore.getState().setAutoSync(true);
  });

  it('imports new workouts and records a quiet result', async () => {
    const save = vi.fn(async () => {});

    expect(await autoSyncOnce(save)).toBe(true);

    expect(save).toHaveBeenCalledTimes(1);
    expect(useHealthStore.getState().lastAutoSync).toMatchObject({ imported: 1, skipped: 0 });
  });

  it('does nothing while off', async () => {
    useHealthStore.getState().setAutoSync(false);
    const save = vi.fn(async () => {});

    expect(await autoSyncOnce(save)).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('waits out the gap after a check', async () => {
    const save = vi.fn(async () => {});
    await autoSyncOnce(save);

    expect(await autoSyncOnce(save)).toBe(false);
  });

  it('never runs twice at once', async () => {
    let release: () => void = () => {};
    const save = vi.fn(() => new Promise<void>((r) => (release = r)));
    const first = autoSyncOnce(save);
    await vi.waitFor(() => expect(save).toHaveBeenCalled());

    expect(await autoSyncOnce(save)).toBe(false);

    release();
    await first;
  });

  it('swallows a failing import', async () => {
    platform.health.readWorkouts = async () => {
      throw new Error('boom');
    };

    expect(await autoSyncOnce(async () => {})).toBe(false);
  });
});

describe('describeAutoSync', () => {
  it('says what was found', () => {
    expect(describeAutoSync({ at: 0, imported: 2 }, '5m ago')).toBe(
      'Last checked 5m ago: 2 new workouts'
    );
    expect(describeAutoSync({ at: 0, imported: 0 }, 'just now')).toBe(
      'Last checked just now: no new workouts'
    );
  });
});
