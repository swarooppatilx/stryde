import { describe, expect, it, vi } from 'vitest';
import { type ActivitySyncDeps, createActivitySync } from '@/services/activitySync';
import type { StepOutcome } from '@/services/postRun';
import type { Activity } from '@/types';
import { BACKOFF_BASE_MS } from '@/utils/syncSchedule';

const NOW = new Date('2026-10-20T12:00:00Z').getTime();

function activity(id: string, minutesAgo: number, over: Partial<Activity> = {}): Activity {
  return { id, createdAt: new Date(NOW - minutesAgo * 60_000), ...over } as Activity;
}

function outcome(record: StepOutcome, onchainFailed = false) {
  const skipped: StepOutcome = { status: 'skipped', reason: 'n/a' };
  return {
    steps: {
      record,
      metadata: skipped,
      season: skipped,
      reward: skipped,
      territory: skipped,
      territoryNft: skipped,
    },
    onchainFailed,
    needsVerification: false,
  };
}
const OK = outcome({ status: 'ok' });
const FAILED = outcome({ status: 'failed', error: new Error('rpc down') }, true);
const NO_WALLET = outcome({ status: 'skipped', reason: 'no wallet' });

function setup(activities: Activity[], over: Partial<ActivitySyncDeps> = {}) {
  const store = new Map(activities.map((a) => [a.id, a]));
  const retry = vi.fn(async (_: Activity) => OK);
  const deps: ActivitySyncDeps = {
    now: () => NOW,
    getActivities: () => [...store.values()],
    retry,
    updateActivity: (id, patch) => {
      const current = store.get(id);
      if (current) store.set(id, { ...current, ...patch });
    },
    isOnline: () => true,
    isSyncing: () => false,
    ...over,
  };
  return { sync: createActivitySync(deps), retry, store };
}

describe('activity sync', () => {
  it('records what the chain lacks, oldest first, and clears its retry state', async () => {
    const { sync, retry, store } = setup([
      activity('new', 5),
      activity('old', 50, { sync: { attempts: 2, nextAttemptAt: NOW - 1 } }),
    ]);

    await sync.drain();

    expect(retry.mock.calls.map(([a]) => a.id)).toEqual(['old', 'new']);
    expect(store.get('old')?.sync).toBeUndefined();
  });

  it('notes a failure with a backoff and stops, rather than hammering a broken chain', async () => {
    const { sync, retry, store } = setup([activity('a', 50), activity('b', 40)]);
    retry.mockResolvedValueOnce(FAILED);

    await sync.drain();

    expect(retry).toHaveBeenCalledTimes(1);
    expect(store.get('a')?.sync).toMatchObject({
      attempts: 1,
      nextAttemptAt: NOW + BACKOFF_BASE_MS,
      lastError: 'rpc down',
    });
  });

  it('counts a throw as a failure too', async () => {
    const { sync, retry, store } = setup([activity('a', 50)]);
    retry.mockRejectedValueOnce(new Error('boom'));

    await sync.drain();

    expect(store.get('a')?.sync?.attempts).toBe(1);
  });

  it('leaves an activity alone until its backoff has passed', async () => {
    const { sync, retry } = setup([
      activity('a', 50, { sync: { attempts: 1, nextAttemptAt: NOW + 1000 } }),
    ]);

    await sync.drain();

    expect(retry).not.toHaveBeenCalled();
  });

  it('does nothing while offline', async () => {
    const { sync, retry } = setup([activity('a', 50)], { isOnline: () => false });

    await sync.drain();

    expect(retry).not.toHaveBeenCalled();
  });

  it('does not count a missing wallet as a failed attempt', async () => {
    const { sync, retry, store } = setup([activity('a', 50), activity('b', 40)]);
    retry.mockResolvedValue(NO_WALLET);

    await sync.drain();

    expect(retry).toHaveBeenCalledTimes(1);
    expect(store.get('a')?.sync).toBeUndefined();
  });

  it('runs one drain at a time', async () => {
    const { sync, retry } = setup([activity('a', 50)]);

    await Promise.all([sync.drain(), sync.drain()]);

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
