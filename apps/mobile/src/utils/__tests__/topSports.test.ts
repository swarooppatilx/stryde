import { describe, expect, it } from 'vitest';
import type { ActivityType } from '@/types';
import { groupSports, shortcutSports } from '@/utils/topSports';

const at = (activityType: ActivityType, day: number) => ({
  activityType,
  createdAt: new Date(2026, 0, day),
});

describe('shortcutSports', () => {
  it('falls back to Run and Ride with no history', () => {
    expect(shortcutSports([])).toEqual(['run', 'ride']);
  });

  it('puts the last used sport first, then the most used other sport', () => {
    const history = [at('run', 1), at('run', 2), at('run', 3), at('yoga', 4), at('swim', 5)];
    expect(shortcutSports(history)).toEqual(['swim', 'run']);
  });

  it('does not depend on the order of the list', () => {
    const history = [at('swim', 5), at('run', 1), at('yoga', 4), at('run', 2)];
    expect(shortcutSports(history)).toEqual(['swim', 'run']);
  });

  it('fills the second card from the defaults when only one sport was ever used', () => {
    expect(shortcutSports([at('hike', 1)])).toEqual(['hike', 'run']);
    expect(shortcutSports([at('run', 1)])).toEqual(['run', 'ride']);
  });
});

describe('shortcutSports with chosen sports', () => {
  it('leads with the chosen sports before any history exists', () => {
    expect(shortcutSports([], ['swim', 'hike'])).toEqual(['swim', 'hike']);
    expect(shortcutSports([], ['yoga'])).toEqual(['yoga', 'run']);
  });

  it('lets history win the first card and fills the second from the choices', () => {
    expect(shortcutSports([at('run', 1)], ['swim', 'run'])).toEqual(['run', 'swim']);
  });

  it('prefers sports actually used over the choices for the second card', () => {
    const history = [at('run', 1), at('yoga', 2), at('yoga', 3), at('run', 4)];
    expect(shortcutSports(history, ['swim'])).toEqual(['run', 'yoga']);
  });
});

describe('groupSports', () => {
  it('groups all twelve sports, leaving out empty groups', () => {
    const groups = groupSports('');
    expect(groups.map((g) => g.title)).toEqual(['Foot', 'Cycle', 'Water', 'Other']);
    expect(groups.flatMap((g) => g.sports.map((s) => s.type))).toHaveLength(12);
  });

  it('filters by label, ignoring case and spaces at the ends', () => {
    const groups = groupSports('  RU ');
    expect(groups.flatMap((g) => g.sports.map((s) => s.type))).toEqual(['run']);
  });

  it('returns nothing when no sport matches', () => {
    expect(groupSports('zzz')).toEqual([]);
  });
});
