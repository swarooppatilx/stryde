import { describe, expect, it, vi } from 'vitest';
import type { Activity } from '../../types';
import { computeAchievements, getUnlockedCount } from '../achievements';

vi.mock('@/constants/theme', () => ({
  AchievementColors: {
    green: '#34C759',
    orange: '#FF9500',
    yellow: '#FFD60A',
    blue: '#007AFF',
    indigo: '#5856D6',
    purple: '#AF52DE',
    red: '#FF3B30',
  },
}));

function makeActivity(overrides: Partial<Activity> & Pick<Activity, 'id' | 'createdAt'>): Activity {
  return {
    userId: 'user1',
    activityType: 'run',
    distance: 5000,
    duration: 1800_000,
    polyline: '',
    territory: null,
    territoryArea: 0,
    ...overrides,
  } as Activity;
}

describe('computeAchievements', () => {
  it('returns all achievements with no activities', () => {
    const achievements = computeAchievements([], 0);
    expect(achievements).toHaveLength(10);
    achievements.forEach((a) => {
      expect(a).toHaveProperty('id');
      expect(a).toHaveProperty('title');
      expect(a).toHaveProperty('unlocked');
    });
  });

  it('unlocks first_activity when >= 1 activity', () => {
    const achievements = computeAchievements([makeActivity({ id: '1', createdAt: new Date() })], 0);
    const first = achievements.find((a) => a.id === 'first_activity');
    expect(first?.unlocked).toBe(true);
  });

  it('does not unlock first_activity with 0 activities', () => {
    const achievements = computeAchievements([], 0);
    const first = achievements.find((a) => a.id === 'first_activity');
    expect(first?.unlocked).toBe(false);
  });

  it('unlocks five_activities at 5', () => {
    const acts = Array.from({ length: 5 }, (_, i) =>
      makeActivity({ id: String(i), createdAt: new Date() })
    );
    const achievements = computeAchievements(acts, 0);
    expect(achievements.find((a) => a.id === 'five_activities')?.unlocked).toBe(true);
  });

  it('unlocks distance milestones', () => {
    const acts = [makeActivity({ id: '1', createdAt: new Date(), distance: 10000 })];
    const achievements = computeAchievements(acts, 0);
    expect(achievements.find((a) => a.id === 'five_km')?.unlocked).toBe(true);
    expect(achievements.find((a) => a.id === 'ten_km')?.unlocked).toBe(true);
    expect(achievements.find((a) => a.id === 'fifty_km')?.unlocked).toBe(false);
  });

  it('unlocks territory milestones', () => {
    const achievements = computeAchievements([], 50_000);
    expect(achievements.find((a) => a.id === 'first_territory')?.unlocked).toBe(true);
    expect(achievements.find((a) => a.id === 'ten_thousand_sqm')?.unlocked).toBe(true);
    expect(achievements.find((a) => a.id === 'hundred_thousand_sqm')?.unlocked).toBe(false);
  });

  it('unlocks week_streak with 7+ unique days', () => {
    const acts = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return makeActivity({ id: String(i), createdAt: d });
    });
    const achievements = computeAchievements(acts, 0);
    expect(achievements.find((a) => a.id === 'week_streak')?.unlocked).toBe(true);
  });
});

describe('getUnlockedCount', () => {
  it('returns 0 for empty array', () => {
    expect(getUnlockedCount([])).toBe(0);
  });

  it('counts only unlocked achievements', () => {
    const achievements = [
      { id: '1', title: 'a', description: '', icon: '', color: '', unlocked: true },
      { id: '2', title: 'b', description: '', icon: '', color: '', unlocked: false },
      { id: '3', title: 'c', description: '', icon: '', color: '', unlocked: true },
    ];
    expect(getUnlockedCount(achievements)).toBe(2);
  });
});
