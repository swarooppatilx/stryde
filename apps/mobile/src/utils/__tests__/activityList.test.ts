import { describe, expect, it } from 'vitest';
import type { Activity } from '@/types';
import { filterActivities, needsPrivacyChange, toggleId } from '@/utils/activityList';

const make = (id: string, patch: Partial<Activity> = {}): Activity =>
  ({
    id,
    userId: 'u',
    name: id,
    activityType: 'run',
    distance: 1000,
    duration: 1000,
    polyline: '',
    territory: null,
    territoryArea: 0,
    createdAt: new Date(2026, 10, 1),
    ...patch,
  }) as Activity;

const now = new Date(2026, 10, 3, 12);
const all = { query: '', sport: 'all', range: 'all' } as const;

describe('filterActivities', () => {
  it('lists the newest first', () => {
    const list = [
      make('old', { createdAt: new Date(2026, 9, 1) }),
      make('new', { createdAt: new Date(2026, 10, 2) }),
    ];
    expect(filterActivities(list, all, now).map((a) => a.id)).toEqual(['new', 'old']);
  });

  it('matches the title in any case, ignoring surrounding spaces', () => {
    const list = [make('a', { name: 'Morning Run' }), make('b', { name: 'Evening ride' })];
    expect(filterActivities(list, { ...all, query: '  morn ' }, now).map((a) => a.id)).toEqual([
      'a',
    ]);
  });

  it('treats an unnamed activity as "Activity"', () => {
    const list = [make('a', { name: undefined })];
    expect(filterActivities(list, { ...all, query: 'activ' }, now)).toHaveLength(1);
  });

  it('narrows to one sport', () => {
    const list = [make('a'), make('b', { activityType: 'ride' })];
    expect(filterActivities(list, { ...all, sport: 'ride' }, now).map((a) => a.id)).toEqual(['b']);
  });

  it('keeps to the day range', () => {
    const list = [
      make('today', { createdAt: new Date(2026, 10, 3, 8) }),
      make('week', { createdAt: new Date(2026, 9, 28) }),
      make('month', { createdAt: new Date(2026, 9, 10) }),
      make('quarter', { createdAt: new Date(2026, 8, 20) }),
      make('lastYear', { createdAt: new Date(2025, 11, 31) }),
    ];
    const ids = (range: 'all' | '7d' | '30d' | '90d' | 'year') =>
      filterActivities(list, { ...all, range }, now).map((a) => a.id);
    expect(ids('7d')).toEqual(['today', 'week']);
    expect(ids('30d')).toEqual(['today', 'week', 'month']);
    expect(ids('90d')).toEqual(['today', 'week', 'month', 'quarter']);
    expect(ids('year')).toEqual(['today', 'week', 'month', 'quarter']);
    expect(ids('all')).toHaveLength(5);
  });
});

describe('toggleId', () => {
  it('adds and removes', () => {
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('needsPrivacyChange', () => {
  it('returns the chosen activities not already at that setting', () => {
    const list = [
      make('a', { privacy: 'only_me' }),
      make('b', { privacy: 'followers' }),
      make('c'),
    ];
    expect(needsPrivacyChange(list, ['a', 'b', 'c'], 'only_me')).toEqual(['b', 'c']);
    expect(needsPrivacyChange(list, ['a', 'b', 'c'], 'everyone')).toEqual(['a', 'b']);
  });
});
