import { describe, expect, it } from 'vitest';
import { EMPTY_ATHLETE_STATS, summarizeAthlete } from '@/utils/athleteStats';

const territory = (areaSqm: number, isActive: boolean) => ({ areaSqm, isActive });

describe('summarizeAthlete', () => {
  it('has nothing to show before (or without) an indexed profile', () => {
    expect(summarizeAthlete(null)).toEqual(EMPTY_ATHLETE_STATS);
    expect(EMPTY_ATHLETE_STATS).toEqual({
      territoryArea: null,
      achievementCount: null,
      isVerified: false,
    });
  });

  it('adds up only territory still held, and counts badges', () => {
    const stats = summarizeAthlete({
      isVerified: true,
      territories: [territory(1000, true), territory(500, false), territory(250, true)],
      achievements: [{}, {}, {}],
    });

    expect(stats).toEqual({ territoryArea: 1250, achievementCount: 3, isVerified: true });
  });

  it('reports zero, not unknown, for an athlete who has indexed data but none of it', () => {
    expect(summarizeAthlete({ isVerified: false, territories: [], achievements: [] })).toEqual({
      territoryArea: 0,
      achievementCount: 0,
      isVerified: false,
    });
  });
});
