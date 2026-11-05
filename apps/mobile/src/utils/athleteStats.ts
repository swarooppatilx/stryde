export interface AthleteStats {
  /** m² of territory still held; null while unknown. */
  territoryArea: number | null;
  achievementCount: number | null;
  /** World ID verification, as other users see it onchain. */
  isVerified: boolean;
}

export const EMPTY_ATHLETE_STATS: AthleteStats = {
  territoryArea: null,
  achievementCount: null,
  isVerified: false,
};

interface CompositeLike {
  isVerified: boolean;
  territories: Array<{ areaSqm: number; isActive: boolean }>;
  achievements: unknown[];
}

/** The profile header stats from the subgraph's composite athlete record. */
export function summarizeAthlete(composite: CompositeLike | null): AthleteStats {
  if (!composite) return EMPTY_ATHLETE_STATS;
  return {
    territoryArea: composite.territories
      .filter((t) => t.isActive)
      .reduce((sum, t) => sum + t.areaSqm, 0),
    achievementCount: composite.achievements.length,
    isVerified: composite.isVerified,
  };
}
