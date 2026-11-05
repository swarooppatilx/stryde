import { describe, expect, it } from 'vitest';
import type { Activity } from '@/types';
import {
  type Goal,
  goalStanding,
  goalTitle,
  periodRange,
  seedGoals,
  targetBounds,
  weeklyTargets,
} from '@/utils/goals';

const activity = (patch: Partial<Activity>): Activity =>
  ({
    id: 'a',
    userId: 'u',
    activityType: 'run',
    distance: 5000,
    duration: 1_800_000,
    polyline: '',
    territory: null,
    territoryArea: 0,
    createdAt: new Date(2026, 10, 3, 9),
    ...patch,
  }) as Activity;

const goal = (patch: Partial<Goal> = {}): Goal => ({
  id: 'g',
  metric: 'distance',
  period: 'week',
  target: 10_000,
  ...patch,
});

// Tuesday 3 November 2026.
const now = new Date(2026, 10, 3, 12);

describe('periodRange', () => {
  it('starts the week on the chosen day', () => {
    expect(periodRange('week', now, 0).start).toEqual(new Date(2026, 10, 1));
    expect(periodRange('week', now, 1).start).toEqual(new Date(2026, 10, 2));
    expect(periodRange('week', now, 1).end).toEqual(new Date(2026, 10, 9));
  });

  it('covers the calendar month and year', () => {
    expect(periodRange('month', now, 0)).toEqual({
      start: new Date(2026, 10, 1),
      end: new Date(2026, 11, 1),
    });
    expect(periodRange('year', now, 0)).toEqual({
      start: new Date(2026, 0, 1),
      end: new Date(2027, 0, 1),
    });
  });
});

describe('goalStanding', () => {
  it('adds up the metric over the period', () => {
    const list = [
      activity({ id: '1', distance: 4000 }),
      activity({ id: '2', distance: 3000, createdAt: new Date(2026, 10, 2) }),
    ];
    const standing = goalStanding(goal(), list, now, 0);
    expect(standing.done).toBe(7000);
    expect(standing.ratio).toBeCloseTo(0.7);
    expect(standing.reached).toBe(false);
  });

  it('counts only the weeks that start on the chosen day', () => {
    const sunday = activity({ createdAt: new Date(2026, 10, 1, 8), distance: 2000 });
    expect(goalStanding(goal(), [sunday], now, 0).done).toBe(2000);
    expect(goalStanding(goal(), [sunday], now, 1).done).toBe(0);
    const monday = activity({ createdAt: new Date(2026, 10, 2, 8), distance: 2000 });
    expect(goalStanding(goal(), [monday], now, 1).done).toBe(2000);
  });

  it('sums elevation, time and counts', () => {
    const list = [activity({ id: '1', elevationGain: 120 }), activity({ id: '2' })];
    expect(goalStanding(goal({ metric: 'elevation', target: 200 }), list, now, 0).done).toBe(120);
    expect(goalStanding(goal({ metric: 'time', target: 1 }), list, now, 0).done).toBe(3_600_000);
    expect(goalStanding(goal({ metric: 'activities', target: 4 }), list, now, 0).done).toBe(2);
  });

  it('keeps to one sport when the goal names it', () => {
    const list = [
      activity({ id: '1' }),
      activity({ id: '2', activityType: 'ride', distance: 9000 }),
    ];
    expect(goalStanding(goal({ sport: 'ride' }), list, now, 0).done).toBe(9000);
  });

  it('ignores other periods and future activities', () => {
    const list = [
      activity({ id: '1', createdAt: new Date(2026, 9, 1) }),
      activity({ id: '2', createdAt: new Date(2026, 10, 20) }),
      activity({ id: '3', createdAt: new Date(2026, 10, 2) }),
    ];
    expect(goalStanding(goal({ period: 'month' }), list, now, 0).done).toBe(5000);
  });

  it('marks a goal reached once the target is met, with the bar capped', () => {
    const standing = goalStanding(goal({ target: 4000 }), [activity({})], now, 0);
    expect(standing.reached).toBe(true);
    expect(standing.ratio).toBe(1);
    expect(standing.done).toBe(5000);
  });

  it('says how many days are left including today', () => {
    expect(goalStanding(goal(), [], now, 0).daysLeft).toBe(5);
    expect(goalStanding(goal(), [], now, 1).daysLeft).toBe(6);
    expect(goalStanding(goal({ period: 'month' }), [], now, 0).daysLeft).toBe(28);
  });

  it('never reaches a zero target', () => {
    const standing = goalStanding(goal({ target: 0 }), [activity({})], now, 0);
    expect(standing.reached).toBe(false);
    expect(standing.ratio).toBe(0);
  });
});

describe('goalTitle', () => {
  it('names the period, metric and sport', () => {
    expect(goalTitle(goal())).toBe('Weekly distance');
    expect(goalTitle(goal({ metric: 'elevation', period: 'year', sport: 'ride' }))).toBe(
      'Yearly elevation · Cycling'
    );
    expect(goalTitle(goal({ metric: 'activities', period: 'month' }))).toBe('Monthly activities');
  });
});

describe('targetBounds', () => {
  it('steps in whole miles for imperial distance', () => {
    const metric = targetBounds('distance', 'week', 'metric');
    const imperial = targetBounds('distance', 'week', 'imperial');
    expect(metric.step).toBe(1000);
    expect(imperial.step).toBeCloseTo(1609.34);
  });

  it('scales with the period and keeps the default inside the bounds', () => {
    for (const metric of ['distance', 'time', 'elevation', 'activities'] as const) {
      const week = targetBounds(metric, 'week', 'metric');
      const year = targetBounds(metric, 'year', 'metric');
      expect(year.max).toBeGreaterThan(week.max);
      for (const b of [week, year]) {
        expect(b.initial).toBeGreaterThanOrEqual(b.min);
        expect(b.initial).toBeLessThanOrEqual(b.max);
      }
    }
  });
});

describe('seedGoals', () => {
  it('turns the three weekly goals into goals', () => {
    expect(
      seedGoals({ distance: 30_000, activities: 4, time: 7_200_000 }).map((g) => [
        g.metric,
        g.period,
        g.target,
      ])
    ).toEqual([
      ['distance', 'week', 30_000],
      ['activities', 'week', 4],
      ['time', 'week', 7_200_000],
    ]);
  });
});

describe('weeklyTargets', () => {
  const fallback = { distance: 20_000, activities: 3, time: 3_600_000 };

  it('prefers a weekly goal for every sport, falling back to the old values', () => {
    const goals = [
      goal({ id: '1', target: 50_000 }),
      goal({ id: '2', sport: 'run', metric: 'activities', target: 9 }),
    ];
    expect(weeklyTargets(goals, fallback)).toEqual({ ...fallback, distance: 50_000 });
  });
});
