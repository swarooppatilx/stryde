import { describe, expect, it } from 'vitest';
import { BANNED_USER_WORDS } from '@/constants/copy';
import type { Activity } from '@/types';
import { weeklyStreakPeak } from '@/utils/weeklyStreak';
import { yearInSport, yearShareMessage } from '@/utils/yearInSport';

const make = (id: string, iso: string, over: Partial<Activity> = {}): Activity =>
  ({
    id,
    userId: 'u',
    activityType: 'run',
    distance: 5000,
    duration: 1_800_000,
    polyline: '',
    territory: null,
    territoryArea: 0,
    createdAt: new Date(iso),
    ...over,
  }) as Activity;

const NOW = new Date(2026, 10, 3, 12);

describe('yearInSport', () => {
  it('totals only the chosen year and ignores the future', () => {
    const list = [
      make('a', '2026-02-10T10:00:00'),
      make('b', '2026-03-10T10:00:00', { distance: 10_000, elevationGain: 50 }),
      make('old', '2025-06-01T10:00:00'),
      make('future', '2026-12-30T10:00:00'),
    ];
    const year = yearInSport(list, 2026, NOW, 1);
    expect(year.count).toBe(2);
    expect(year.distance).toBe(15_000);
    expect(year.elevation).toBe(50);
    expect(year.activeDays).toBe(2);
    expect(year.topMonth).toBe(2);
    expect(year.longest).toEqual({ id: 'b', sport: 'run', distance: 10_000 });
  });

  it('is empty-safe', () => {
    const year = yearInSport([], 2026, NOW, 1);
    expect(year).toMatchObject({
      count: 0,
      topMonth: null,
      topWeekday: null,
      longest: null,
      bestWeeklyStreak: 0,
    });
  });

  it('breaks sports out, most distance first', () => {
    const list = [
      make('a', '2026-01-05T10:00:00'),
      make('b', '2026-01-06T10:00:00', { activityType: 'ride', distance: 30_000 }),
    ];
    expect(yearInSport(list, 2026, NOW, 1).sports.map((s) => s.sport)).toEqual(['ride', 'run']);
  });
});

describe('weeklyStreakPeak', () => {
  it('finds the longest run of weeks, not the latest', () => {
    const dates = [
      '2026-01-05T10:00:00',
      '2026-01-12T10:00:00',
      '2026-01-19T10:00:00',
      '2026-03-02T10:00:00',
      '2026-03-09T10:00:00',
    ];
    expect(
      weeklyStreakPeak(
        dates.map((d) => ({ createdAt: new Date(d) })),
        1
      )
    ).toBe(3);
  });
  it('is zero with nothing logged', () => {
    expect(weeklyStreakPeak([], 1)).toBe(0);
  });
});

describe('yearShareMessage', () => {
  it('says what was done in plain words', () => {
    const year = yearInSport([make('a', '2026-02-10T10:00:00')], 2026, NOW, 1);
    const message = yearShareMessage(year, '5.00km');
    expect(message).toBe('My 2026 on Stryde: 5.00km across 1 activity on 1 day.');
    expect(message).not.toMatch(BANNED_USER_WORDS);
  });
  it('has a line for an empty year', () => {
    expect(yearShareMessage(yearInSport([], 2026, NOW, 1), '0m')).toBe(
      'My 2026 on Stryde starts here.'
    );
  });
});
