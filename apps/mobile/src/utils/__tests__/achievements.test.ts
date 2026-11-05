import { describe, expect, it, vi } from 'vitest';
import type { Activity } from '@/types';
import { achievementsEarnedBy, computeAchievements, getUnlockedCount } from '@/utils/achievements';

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

describe('computeAchievements with manual entries', () => {
  const unlocked = (list: ReturnType<typeof computeAchievements>) =>
    list.filter((a) => a.unlocked).map((a) => a.id);

  it('lets a typed-in run earn "first activity" but not the 5K badge', () => {
    const manual = makeActivity({
      id: 'm1',
      createdAt: new Date('2026-01-02T10:00:00Z'),
      distance: 42_000,
      isManual: true,
    });

    expect(unlocked(computeAchievements([manual], 0))).toEqual(['first_activity']);
  });

  it('still counts a recorded run of the same length', () => {
    const recorded = makeActivity({
      id: 'r1',
      createdAt: new Date('2026-01-02T10:00:00Z'),
      distance: 42_000,
    });

    expect(unlocked(computeAchievements([recorded], 0))).toContain('five_km');
    expect(unlocked(computeAchievements([recorded], 0))).toContain('ten_km');
  });
});

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

describe('5K Runner counts runs only', () => {
  const unlocked = (list: Activity[]) =>
    computeAchievements(list, 0).find((a) => a.id === 'five_km')?.unlocked;
  const day = new Date('2026-01-01T10:00:00Z');

  it('is not earned by a 6 km hike, as its description says "Run 5km total"', () => {
    expect(
      unlocked([makeActivity({ id: 'h', createdAt: day, activityType: 'hike', distance: 6000 })])
    ).toBe(false);
  });

  it('is earned by running 5 km in total across several runs', () => {
    expect(
      unlocked([
        makeActivity({ id: 'a', createdAt: day, distance: 3000 }),
        makeActivity({ id: 'b', createdAt: day, distance: 2000 }),
      ])
    ).toBe(true);
  });

  it('still lets any sport count towards "Cover 10km total"', () => {
    const tenK = computeAchievements(
      [
        makeActivity({ id: 'r', createdAt: day, distance: 4000 }),
        makeActivity({ id: 'h', createdAt: day, activityType: 'hike', distance: 6000 }),
      ],
      0
    ).find((a) => a.id === 'ten_km');
    expect(tenK?.unlocked).toBe(true);
  });
});

describe('achievementsEarnedBy', () => {
  const day = (n: number) => new Date(`2026-01-${String(n).padStart(2, '0')}T10:00:00Z`);

  it('credits an achievement to the activity that crossed its line, and only that one', () => {
    const list = Array.from({ length: 6 }, (_, i) =>
      makeActivity({ id: `a${i + 1}`, createdAt: day(i + 1), distance: 100 })
    );

    const earned = achievementsEarnedBy(list);

    expect(earned.get('a1')?.map((a) => a.id)).toEqual(['first_activity']);
    expect(earned.get('a5')?.map((a) => a.id)).toEqual(['five_activities']);
    expect(earned.get('a2')).toBeUndefined();
    expect(earned.get('a6')).toBeUndefined();
  });

  it('goes by date, not by the order of the list', () => {
    const newer = makeActivity({ id: 'new', createdAt: day(9) });
    const older = makeActivity({ id: 'old', createdAt: day(2) });

    const earned = achievementsEarnedBy([newer, older]);

    expect(earned.get('old')?.map((a) => a.id)).toContain('first_activity');
    expect(earned.get('new')?.map((a) => a.id) ?? []).not.toContain('first_activity');
  });

  it('credits distance and territory badges to the activity that added the last bit', () => {
    const a = makeActivity({ id: 'a', createdAt: day(1), distance: 4000 });
    const b = makeActivity({ id: 'b', createdAt: day(2), distance: 3000, territoryArea: 500 });

    const earned = achievementsEarnedBy([a, b]);

    expect(earned.get('b')?.map((x) => x.id)).toEqual(
      expect.arrayContaining(['five_km', 'first_territory'])
    );
    expect(earned.get('a')?.map((x) => x.id)).toEqual(['first_activity']);
  });

  it('is empty for no activities', () => {
    expect(achievementsEarnedBy([]).size).toBe(0);
  });
});
