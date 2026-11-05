import { keccak256, toBytes } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import { ACHIEVEMENT_RULES as SHARED_RULES } from '../../../../shared/src/achievementRules';
import { ACHIEVEMENT_RULES, checkAchievement } from '../achievementCheck.js';
import type { ChainIndex } from '../index/types.js';

const ATHLETE = '0x00000000000000000000000000000000000000aa';
const idOf = (rule: string) => keccak256(toBytes(rule));

function fakeIndex(
  activities: Array<{ distance: number; activityType: number; timestamp: number }>,
  territoryArea = 0
): ChainIndex {
  return {
    headTimestamp: async () => 0,
    challenge: async () => null,
    activities: vi.fn(async () =>
      activities.map((a) => ({
        user: ATHLETE as `0x${string}`,
        activityHash: `0x${'ab'.repeat(32)}` as const,
        duration: 600,
        ...a,
      }))
    ),
    activeTerritoryArea: vi.fn(async () => territoryArea),
  };
}

describe('checkAchievement', () => {
  it('approves a badge the athlete earned onchain, under its canonical name', async () => {
    const index = fakeIndex([{ distance: 5200, activityType: 0, timestamp: 1767225600 }]);

    expect(await checkAchievement(index, ATHLETE, idOf('five_km'))).toEqual({
      ok: true,
      name: '5K Runner',
    });
  });

  it('refuses a badge the record does not earn', async () => {
    const index = fakeIndex([{ distance: 5200, activityType: 1, timestamp: 1767225600 }]);

    expect(await checkAchievement(index, ATHLETE, idOf('five_km'))).toEqual({
      ok: false,
      reason: 'not_earned',
    });
  });

  it('refuses an achievement id that is not one of ours without reading the chain', async () => {
    const index = fakeIndex([]);

    expect(await checkAchievement(index, ATHLETE, idOf('made_up'))).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(index.activities).not.toHaveBeenCalled();
  });

  it('uses the territory the athlete holds for area badges', async () => {
    const index = fakeIndex([], 12_000);

    expect(await checkAchievement(index, ATHLETE, idOf('ten_thousand_sqm'))).toMatchObject({
      ok: true,
    });
    expect(index.activeTerritoryArea).toHaveBeenCalledWith(ATHLETE);
  });

  it('counts distinct days for the streak badge, not activities', async () => {
    const day = 86_400;
    const sameDay = Array.from({ length: 8 }, (_, i) => ({
      distance: 1000,
      activityType: 0,
      timestamp: 10 * day + i,
    }));

    expect(await checkAchievement(fakeIndex(sameDay), ATHLETE, idOf('week_streak'))).toEqual({
      ok: false,
      reason: 'not_earned',
    });
  });
});

// The API keeps its own copy until it can depend on @repo/shared (A7).
describe('parity with @repo/shared', () => {
  const samples = [
    { activityCount: 0, totalDistance: 0, runDistance: 0, activeDays: 0, territoryArea: 0 },
    { activityCount: 1, totalDistance: 4999, runDistance: 4999, activeDays: 1, territoryArea: 1 },
    {
      activityCount: 5,
      totalDistance: 10_000,
      runDistance: 5000,
      activeDays: 6,
      territoryArea: 9_999,
    },
    {
      activityCount: 10,
      totalDistance: 50_000,
      runDistance: 0,
      activeDays: 7,
      territoryArea: 100_000,
    },
  ];

  it('has the same ids and names, and agrees on every sample', () => {
    expect(ACHIEVEMENT_RULES.map((r) => [r.id, r.name])).toEqual(
      SHARED_RULES.map((r) => [r.id, r.name])
    );
    for (const stats of samples) {
      expect(ACHIEVEMENT_RULES.map((r) => r.unlocked(stats))).toEqual(
        SHARED_RULES.map((r) => r.unlocked(stats))
      );
    }
  });
});
