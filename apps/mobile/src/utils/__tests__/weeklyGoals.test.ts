import { describe, expect, it } from 'vitest';
import { goalsChanged, WEEKLY_GOAL_STEPS } from '@/utils/weeklyGoals';

describe('WEEKLY_GOAL_STEPS', () => {
  it('never lets a goal be set to zero, which would make the progress bars meaningless', () => {
    for (const goal of Object.values(WEEKLY_GOAL_STEPS)) {
      expect(goal.min).toBeGreaterThan(0);
    }
  });

  it('starts at one step and has room to grow', () => {
    for (const goal of Object.values(WEEKLY_GOAL_STEPS)) {
      expect(goal.min).toBe(goal.step);
      expect(goal.max).toBeGreaterThan(goal.min);
    }
  });
});

describe('goalsChanged', () => {
  const defaults = {
    weeklyGoalDistance: 20_000,
    weeklyGoalActivities: 3,
    weeklyGoalTime: 3_600_000,
  };

  it('is false while every goal is at its default', () => {
    expect(goalsChanged(defaults, defaults)).toBe(false);
  });

  it('is true as soon as any goal differs', () => {
    expect(goalsChanged({ ...defaults, weeklyGoalActivities: 4 }, defaults)).toBe(true);
    expect(goalsChanged({ ...defaults, weeklyGoalDistance: 25_000 }, defaults)).toBe(true);
    expect(goalsChanged({ ...defaults, weeklyGoalTime: 1_800_000 }, defaults)).toBe(true);
  });
});
