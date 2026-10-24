import { describe, expect, it } from 'vitest';
import { goalProgress, weeksInMonth, weeksInYear } from '@/utils/goalProgress';

const weekly = { distance: 20_000, activities: 3, time: 3_600_000 };

describe('weeksInMonth and weeksInYear', () => {
  it('count the days in the period as weeks', () => {
    expect(weeksInMonth(new Date(2026, 9, 21))).toBeCloseTo(31 / 7, 5);
    expect(weeksInMonth(new Date(2026, 1, 3))).toBeCloseTo(28 / 7, 5);
    expect(weeksInYear(new Date(2026, 5, 1))).toBeCloseTo(365 / 7, 5);
    expect(weeksInYear(new Date(2028, 5, 1))).toBeCloseTo(366 / 7, 5);
  });
});

describe('goalProgress', () => {
  it('scales the weekly goals to the period and says how far along the athlete is', () => {
    const progress = goalProgress({ distance: 40_000, duration: 1_800_000, count: 4 }, weekly, 4);

    expect(progress.distance).toEqual({ done: 40_000, goal: 80_000, ratio: 0.5 });
    expect(progress.time).toEqual({ done: 1_800_000, goal: 14_400_000, ratio: 0.125 });
    expect(progress.activities).toEqual({ done: 4, goal: 12, ratio: 4 / 12 });
  });

  it('caps the ratio at 1 once the goal is passed, but keeps the real total', () => {
    const progress = goalProgress({ distance: 200_000, duration: 0, count: 0 }, weekly, 4);

    expect(progress.distance.done).toBe(200_000);
    expect(progress.distance.ratio).toBe(1);
  });
});
