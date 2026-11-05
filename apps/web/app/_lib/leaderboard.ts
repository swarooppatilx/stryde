import { querySubgraph, shortAddress, subgraphUrl } from './subgraph';

export interface SeasonParticipantRow {
  totalContribution: string;
  user: {
    id: string;
    username: string;
    isVerified: boolean;
    territories: Array<{ area: string; isActive: boolean }>;
  };
}

export interface LeaderboardRow {
  rank: number;
  athlete: string;
  verified: boolean;
  distanceMeters: number;
  territorySqm: number;
}

const MAX_ROWS = 20;

/** The season's participants as a ranked table: by distance, with the territory each still holds. */
export function toRows(participants: readonly SeasonParticipantRow[]): LeaderboardRow[] {
  return participants
    .map((p) => ({
      athlete: p.user.username || shortAddress(p.user.id),
      verified: p.user.isVerified,
      distanceMeters: Number(p.totalContribution),
      territorySqm: p.user.territories
        .filter((t) => t.isActive)
        .reduce((sum, t) => sum + Number(t.area), 0),
    }))
    .sort((a, b) => b.distanceMeters - a.distanceMeters)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

export function formatKm(meters: number): string {
  if (meters === 0) return '0 km';
  return `${(Math.floor(meters / 100) / 10).toFixed(1)} km`;
}

export function formatArea(sqm: number): string {
  if (sqm >= 1_000_000) return `${(sqm / 1_000_000).toFixed(1)} km²`;
  return `${Math.round(sqm).toLocaleString('en-US')} m²`;
}

/** The latest season's leaderboard straight from the subgraph; null when it can't be reached. */
export async function fetchLeaderboard(url = subgraphUrl()): Promise<LeaderboardRow[] | null> {
  try {
    const { seasons } = await querySubgraph<{ seasons: Array<{ id: string }> }>(
      url,
      '{ seasons(first: 1, orderBy: startTime, orderDirection: desc) { id } }'
    );
    const season = seasons[0];
    if (!season) return [];

    const { seasonParticipants } = await querySubgraph<{
      seasonParticipants: SeasonParticipantRow[];
    }>(
      url,
      `query($season: String!) {
        seasonParticipants(first: ${MAX_ROWS}, where: { season: $season }, orderBy: totalContribution, orderDirection: desc) {
          totalContribution
          user { id username isVerified territories(first: 1000, where: { isActive: true }) { area isActive } }
        }
      }`,
      { season: season.id }
    );
    return toRows(seasonParticipants);
  } catch {
    return null;
  }
}
