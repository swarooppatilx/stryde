import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENT_RULES,
  achievementStats,
  unlockedAchievementIds,
} from '../../achievementRules';

const day = (n: number) => Date.UTC(2026, 0, 1 + n) / 1000;
const run = (meters: number, dayIndex: number) => ({
  distance: meters,
  activityType: 'run' as const,
  timestamp: day(dayIndex),
});

describe('achievement rules', () => {
  it('summarises activities into the stats the rules read', () => {
    const stats = achievementStats(
      [run(3000, 0), run(2500, 0), { distance: 8000, activityType: 'ride', timestamp: day(1) }],
      12_000
    );

    expect(stats).toEqual({
      activityCount: 3,
      totalDistance: 13_500,
      runDistance: 5_500,
      activeDays: 2,
      territoryArea: 12_000,
    });
  });

  it('unlocks exactly the badges the stats earn', () => {
    const ids = unlockedAchievementIds(achievementStats([run(3000, 0), run(2500, 1)], 0));

    expect(ids).toEqual(['first_activity', 'five_km']);
  });

  it('counts a manual entry as an activity and an active day, but not toward distance badges', () => {
    const typedIn = {
      distance: 100_000,
      activityType: 'run' as const,
      timestamp: day(3),
      isManual: true,
    };

    const stats = achievementStats([run(2000, 0), typedIn], 0);

    expect(stats).toMatchObject({
      activityCount: 2,
      activeDays: 2,
      totalDistance: 2000,
      runDistance: 2000,
    });
    expect(unlockedAchievementIds(stats)).toEqual(['first_activity']);
  });

  it('has a unique id per rule', () => {
    const ids = ACHIEVEMENT_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
