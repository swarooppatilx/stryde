import { getActiveConfig } from './client';
import { querySubgraph } from './subgraphClient';

interface UserStreakEntity {
  id: string;
  user: { id: string; username: string };
  currentStreak: string;
  longestStreak: string;
  lastActiveDay: string;
  totalActiveDays: string;
  updatedAt: string;
}

const USER_STREAK_QUERY = `
  query GetUserStreak($wallet: Bytes!) {
    userStreak(id: $wallet) {
      id
      user { id username }
      currentStreak
      longestStreak
      lastActiveDay
      totalActiveDays
      updatedAt
    }
  }
`;

export interface SubgraphUserStreak {
  wallet: string;
  username: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDay: number;
  totalActiveDays: number;
}

export async function getUserStreakFromSubgraph(
  wallet: `0x${string}`
): Promise<SubgraphUserStreak | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const data = await querySubgraph<{ userStreak: UserStreakEntity | null }>(
    subgraphUrl,
    USER_STREAK_QUERY,
    { wallet: wallet.toLowerCase() }
  );

  if (!data.userStreak) return null;

  const streak = data.userStreak;
  return {
    wallet: streak.user.id,
    username: streak.user.username,
    currentStreak: Number(streak.currentStreak),
    longestStreak: Number(streak.longestStreak),
    lastActiveDay: Number(streak.lastActiveDay),
    totalActiveDays: Number(streak.totalActiveDays),
  };
}

interface LeaderboardSnapshotEntity {
  id: string;
  user: { id: string; username: string; isVerified: boolean };
  totalDistance: string;
  lastContribution: string;
  computedAt: string;
}

const LEADERBOARD_SNAPSHOT_QUERY = `
  query GetLeaderboardSnapshot($seasonId: String!) {
    leaderboardSnapshots(
      first: 1000
      where: { season: $seasonId }
      orderBy: totalDistance
      orderDirection: desc
    ) {
      id
      user { id username isVerified }
      totalDistance
      lastContribution
      computedAt
    }
  }
`;

/** A participant's season distance standing; distance only (the weighted leaderboard is computed by services.season.getWeightedLeaderboard). */
export interface SubgraphLeaderboardSnapshot {
  wallet: string;
  username: string;
  isVerified: boolean;
  rank: number;
  totalDistance: number;
  lastContribution: number;
  computedAt: number;
}

export async function getLeaderboardSnapshotFromSubgraph(
  seasonId: bigint
): Promise<SubgraphLeaderboardSnapshot[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const data = await querySubgraph<{ leaderboardSnapshots: LeaderboardSnapshotEntity[] }>(
    subgraphUrl,
    LEADERBOARD_SNAPSHOT_QUERY,
    { seasonId: seasonId.toString() }
  );

  return data.leaderboardSnapshots.map((s, i) => ({
    wallet: s.user.id,
    username: s.user.username,
    isVerified: s.user.isVerified,
    rank: i + 1,
    totalDistance: Number(s.totalDistance),
    lastContribution: Number(s.lastContribution),
    computedAt: Number(s.computedAt),
  }));
}

interface TerritoryStrengthHistoryEntity {
  id: string;
  territory: { id: string; owner: { id: string } };
  strength: string;
  changeType: string;
  blockNumber: string;
  timestamp: string;
}

const TERRITORY_HISTORY_QUERY = `
  query GetTerritoryHistory($territoryId: Bytes!, $first: Int!) {
    territoryStrengthHistories(
      first: $first
      where: { territory: $territoryId }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      territory { id owner { id } }
      strength
      changeType
      blockNumber
      timestamp
    }
  }
`;

export interface SubgraphTerritoryHistoryEntry {
  territoryId: string;
  owner: string;
  strength: number;
  changeType: string;
  blockNumber: number;
  timestamp: number;
}

export async function getTerritoryHistoryFromSubgraph(
  territoryId: `0x${string}`,
  limit = 100
): Promise<SubgraphTerritoryHistoryEntry[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const data = await querySubgraph<{
    territoryStrengthHistories: TerritoryStrengthHistoryEntity[];
  }>(subgraphUrl, TERRITORY_HISTORY_QUERY, {
    territoryId: territoryId.toLowerCase(),
    first: limit,
  });

  return data.territoryStrengthHistories.map((h) => ({
    territoryId: h.territory.id,
    owner: h.territory.owner.id,
    strength: Number(h.strength),
    changeType: h.changeType,
    blockNumber: Number(h.blockNumber),
    timestamp: Number(h.timestamp),
  }));
}
