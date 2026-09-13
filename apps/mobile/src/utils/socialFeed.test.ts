import { describe, expect, it } from 'vitest';
import type { SocialActivity } from '../stores/socialStore';
import type { Activity } from '../types';
import { mergeLocalActivities } from './socialFeed';

const local: Activity = {
  id: 'local-1',
  userId: 'me',
  activityType: 'run',
  distance: 1000,
  duration: 300,
  polyline: 'local-route',
  territory: null,
  territoryArea: 0,
  privacy: 'only_me',
  createdAt: new Date('2026-09-12'),
};

describe('mergeLocalActivities', () => {
  it('includes local-only activities alongside other users posts without mutating inputs', () => {
    const other: SocialActivity = {
      ...local,
      id: 'other',
      userId: 'other',
      kudos: [],
      comments: [],
    };
    const remote: Record<string, SocialActivity> = { other };
    const result = mergeLocalActivities(remote, [local]);
    expect(Object.values(result).map((a) => a.id)).toEqual(['other', 'local-1']);
    expect(result.other).toMatchObject({ id: 'other', kudos: [], comments: [] });
    expect(result['local-1']).toMatchObject({ privacy: 'only_me', kudos: [], comments: [] });
    expect(remote).toEqual({ other });
  });

  it('deduplicates chain records by hash, retaining local details and social interactions', () => {
    const remote: Record<string, SocialActivity> = {
      'hash-1': {
        ...local,
        id: 'hash-1',
        activityHash: 'hash-1',
        polyline: '',
        kudos: ['friend'],
        comments: [],
      },
    };
    const result = mergeLocalActivities(remote, [{ ...local, activityHash: 'hash-1' }]);
    expect(Object.keys(result)).toEqual(['hash-1']);
    expect(result['hash-1']).toMatchObject({
      id: 'local-1',
      polyline: 'local-route',
      kudos: ['friend'],
    });
  });

  it('keeps local-only interactions when synchronized repeatedly', () => {
    const first = mergeLocalActivities({}, [local]);
    first['local-1'].kudos = ['friend'];
    const second = mergeLocalActivities(first, [local]);
    expect(Object.keys(second)).toEqual(['local-1']);
    expect(second['local-1'].kudos).toEqual(['friend']);
  });

  it('preserves chain activityId through merge', () => {
    const remote: Record<string, SocialActivity> = {
      'hash-1': {
        ...local,
        id: 'hash-1',
        activityHash: 'hash-1',
        activityId: '42',
        kudos: [],
        comments: [],
      },
    };
    const result = mergeLocalActivities(remote, [{ ...local, activityHash: 'hash-1' }]);
    expect(result['hash-1'].activityId).toBe('42');
  });

  it('uses the local on-chain id when the chain copy has none yet', () => {
    const result = mergeLocalActivities({}, [{ ...local, onchainActivityId: '7' }]);
    expect(result['local-1'].activityId).toBe('7');
  });
});
