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
    const remote = [other];
    const result = mergeLocalActivities(remote, [local]);
    expect(result.map((a) => a.id)).toEqual(['other', 'local-1']);
    expect(result[1]).toMatchObject({ privacy: 'only_me', kudos: [], comments: [] });
    expect(remote).toEqual([other]);
  });

  it('deduplicates chain records by hash, retaining local details and social interactions', () => {
    const remote: SocialActivity = {
      ...local,
      id: 'hash-1',
      activityHash: 'hash-1',
      polyline: '',
      kudos: ['friend'],
      comments: [],
    };
    const result = mergeLocalActivities([remote], [{ ...local, activityHash: 'hash-1' }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'local-1', polyline: 'local-route', kudos: ['friend'] });
  });

  it('keeps local-only interactions when synchronized repeatedly', () => {
    const first = mergeLocalActivities([], [local]);
    first[0].kudos = ['friend'];
    const second = mergeLocalActivities(first, [local]);
    expect(second).toHaveLength(1);
    expect(second[0].kudos).toEqual(['friend']);
  });
});
