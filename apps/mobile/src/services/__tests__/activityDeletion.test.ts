import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';
import { deleteActivity } from '@/services/activityDeletion';
import { mergeChainActivities } from '@/services/chainSync';
import { useActivityStore } from '@/stores/activityStore';
import { useSocialStore } from '@/stores/socialStore';
import type { Activity } from '@/types';

const HASH = `0x${'ab'.repeat(32)}`;

const activity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'a1',
  userId: '0xme',
  activityType: 'run',
  distance: 5000,
  duration: 1_800_000,
  polyline: '',
  territory: null,
  territoryArea: 0,
  activityHash: HASH,
  createdAt: new Date('2026-01-01T10:00:00Z'),
  ...overrides,
});

beforeEach(() => {
  installFakePlatform();
  useActivityStore.getState().reset();
  useSocialStore.getState().reset();
});

describe('deleting an activity', () => {
  it('removes it from the list and from the Home feed', () => {
    useActivityStore.getState().saveActivity(activity());
    useSocialStore.getState().syncLocalActivities();
    expect(
      useSocialStore
        .getState()
        .getFeed()
        .map((a) => a.id)
    ).toEqual(['a1']);

    deleteActivity('a1');

    expect(useActivityStore.getState().activities).toEqual([]);
    expect(useSocialStore.getState().getFeed()).toEqual([]);
  });

  it('stays deleted when the chain sync later returns it again', () => {
    useActivityStore.getState().saveActivity(activity());
    deleteActivity('a1');

    const fromChain = {
      activityHash: HASH,
      owner: '0xme',
      activityId: 1n,
      activityType: 'run' as const,
      distance: 5000,
      duration: 1_800_000,
      territoryArea: 0,
      timestamp: 1_767_268_800,
      metadata: '',
    };
    const merged = mergeChainActivities(
      useActivityStore.getState().activities,
      [fromChain],
      new Set(useActivityStore.getState().deletedHashes)
    );

    expect(merged).toEqual([]);
  });

  it('forgets nothing else: other activities stay', () => {
    useActivityStore.getState().saveActivity(activity());
    useActivityStore
      .getState()
      .saveActivity(activity({ id: 'a2', activityHash: `0x${'cd'.repeat(32)}` }));

    deleteActivity('a1');

    expect(useActivityStore.getState().activities.map((a) => a.id)).toEqual(['a2']);
  });
});
