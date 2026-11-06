import { getActiveConfig } from './client';
import { indexCall } from './indexApi';
import { querySubgraph } from './subgraphClient';

interface SeasonParticipantEntity {
  totalContribution: string;
  user: {
    id: string;
    username: string;
    isVerified: boolean;
    territories: { area: string }[];
    achievements: { id: string }[];
  };
}

/** One query spanning SeasonManager (contribution totals) + TerritoryRegistry
 * (active territory area) + AchievementRegistry (achievement count) +
 * ProfileRegistry (username + World ID verification status), via the
 * SeasonParticipant -> Profile relation — a composed multi-metric leaderboard
 * rather than a single-registry query. */
const SEASON_LEADERBOARD_QUERY = `
  query GetSeasonLeaderboard($seasonId: String!) {
    seasonParticipants(
      first: 1000
      where: { season: $seasonId }
      orderBy: totalContribution
      orderDirection: desc
    ) {
      totalContribution
      user {
        id
        username
        isVerified
        territories(first: 1000, where: { isActive: true }) {
          area
        }
        achievements(first: 1000) {
          id
        }
      }
    }
  }
`;

export interface SubgraphLeaderboardEntry {
  wallet: string;
  username: string;
  isVerified: boolean;
  distance: number;
  territoryArea: number;
  achievementCount: number;
  /** Weighted composite rank: distance + a fraction of territory area (sqm)
   * + a fixed bonus per achievement, then a sybil-resistance multiplier for
   * World ID Selfie Check-verified athletes. Weights are tuned for a running
   * app where distances are in meters (hundreds-thousands) and territory
   * areas are typically larger (thousands-tens of thousands of sqm). */
  score: number;
}

const TERRITORY_AREA_WEIGHT = 0.05;
const ACHIEVEMENT_WEIGHT = 500;
/** World ID-verified athletes rank 10% higher at equal raw stats — a UX-level
 * sybil-resistance signal (see FEEDBACK.md), not a hard requirement. */
const VERIFIED_SCORE_MULTIPLIER = 1.1;

/** The composite rank: distance, plus territory and achievements at their weights, times the verified bonus. */
export function weightedScore(input: {
  distance: number;
  territoryArea: number;
  achievementCount: number;
  isVerified: boolean;
}): number {
  const raw =
    input.distance +
    input.territoryArea * TERRITORY_AREA_WEIGHT +
    input.achievementCount * ACHIEVEMENT_WEIGHT;
  return input.isVerified ? raw * VERIFIED_SCORE_MULTIPLIER : raw;
}

/** Multi-metric leaderboard (distance + territory area + achievements) for a
 * season, ranked by a weighted composite score. Returns null (rather than
 * throwing) when no subgraph is configured for the active chain mode, so
 * callers can fall back to the on-chain, distance-only leaderboard. */
export async function getLeaderboardFromSubgraph(
  seasonId: bigint
): Promise<SubgraphLeaderboardEntry[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) {
    const answer = await indexCall<{ entries: Omit<SubgraphLeaderboardEntry, 'score'>[] }>(
      `leaderboard/${seasonId}`
    );
    return (
      answer?.entries
        .map((e) => ({ ...e, score: weightedScore(e) }))
        .sort((a, b) => b.score - a.score) ?? null
    );
  }

  const data = await querySubgraph<{ seasonParticipants: SeasonParticipantEntity[] }>(
    subgraphUrl,
    SEASON_LEADERBOARD_QUERY,
    { seasonId: seasonId.toString() }
  );

  const entries = data.seasonParticipants.map((sp) => {
    const distance = Number(sp.totalContribution);
    const territoryArea = sp.user.territories.reduce((sum, t) => sum + Number(t.area), 0);
    const achievementCount = sp.user.achievements.length;
    return {
      wallet: sp.user.id,
      isVerified: sp.user.isVerified,
      username: sp.user.username,
      distance,
      territoryArea,
      achievementCount,
      score: weightedScore({
        distance,
        territoryArea,
        achievementCount,
        isVerified: sp.user.isVerified,
      }),
    } satisfies SubgraphLeaderboardEntry;
  });

  return entries.sort((a, b) => b.score - a.score);
}

/** Every recorded activity across all users, plus the wallet each belongs to,
 * for the cross-user map route layer. Returns null (rather than throwing) when
 * no subgraph is configured for the active chain mode. Routes need heights, so
 * only records whose metadata (which embeds the polyline `coordinates`) has
 * been pinned to IPFS are returned — the count is bounded to the most recent
 * records to keep the IPFS metadata fetches on the client cheap. */
