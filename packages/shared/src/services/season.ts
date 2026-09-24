import { createTtlCache } from './cache';
import {
  getActiveConfig,
  getChainMode,
  getContracts,
  getPublicClient,
  type getWalletClient,
} from './client';
import { relayRecordContribution, relayStartSeason } from './relay';
import { getLeaderboardFromSubgraph, type SubgraphLeaderboardEntry } from './subgraph';

export type { SubgraphLeaderboardEntry } from './subgraph';

const _THIRTY_DAYS_SECONDS = 30n * 24n * 60n * 60n;
const CURRENT_SEASON_TTL_MS = 10 * 1000;
const CONTRIBUTION_TTL_MS = 10 * 1000;
const LEADERBOARD_TTL_MS = 15 * 1000;
const MULTICALL_CHUNK_SIZE = 100;

export interface SyncedSeason {
  id: bigint;
  startTime: number;
  endTime: number;
  isActive: boolean;
}

interface RawSeason {
  id: bigint;
  startTime: bigint;
  endTime: bigint;
  isActive: boolean;
}

function compareDescending(a: bigint, b: bigint): number {
  if (a > b) return -1;
  return a < b ? 1 : 0;
}

function toSyncedSeason(raw: RawSeason): SyncedSeason {
  return {
    id: raw.id,
    startTime: Number(raw.startTime),
    endTime: Number(raw.endTime),
    isActive: raw.isActive,
  };
}

const currentSeasonCache = createTtlCache<SyncedSeason>(CURRENT_SEASON_TTL_MS);
const contributionCache = createTtlCache<bigint>(CONTRIBUTION_TTL_MS);
const leaderboardCache = createTtlCache<LeaderboardEntry[]>(LEADERBOARD_TTL_MS);

export function invalidateSeasonCaches(): void {
  currentSeasonCache.clear();
  contributionCache.clear();
  leaderboardCache.clear();
}

export async function getCurrentSeason(): Promise<SyncedSeason> {
  const key = `${getChainMode()}:${getActiveConfig().rpcUrl}`;
  const cached = currentSeasonCache.get(key);
  if (cached !== undefined) return cached;

  const client = getPublicClient();
  const contracts = getContracts();
  const raw = (await client.readContract({
    ...contracts.seasonManager,
    functionName: 'getCurrentSeason',
  })) as RawSeason;
  const season = toSyncedSeason(raw);
  currentSeasonCache.set(key, season);
  return season;
}

export async function getParticipantContribution(
  seasonId: bigint,
  participant: `0x${string}`
): Promise<bigint> {
  const key = `${getChainMode()}:${seasonId.toString()}:${participant.toLowerCase()}`;
  const cached = contributionCache.get(key);
  if (cached !== undefined) return cached;

  const client = getPublicClient();
  const contracts = getContracts();
  const contribution = (await client.readContract({
    ...contracts.seasonManager,
    functionName: 'getParticipantContribution',
    args: [seasonId, participant],
  })) as bigint;

  contributionCache.set(key, contribution);
  return contribution;
}

export interface LeaderboardEntry {
  participant: `0x${string}`;
  contribution: bigint;
}

export async function getLeaderboard(
  seasonId: bigint,
  participants: `0x${string}`[]
): Promise<LeaderboardEntry[]> {
  const key = `${getChainMode()}:${seasonId.toString()}:${participants
    .map((p) => p.toLowerCase())
    .sort()
    .join(',')}`;
  const cached = leaderboardCache.get(key);
  if (cached !== undefined) return cached;

  const contributions = await batchGetContributions(seasonId, participants);

  const leaderboard = participants
    .map((participant, i) => ({ participant, contribution: contributions[i] ?? 0n }))
    .filter((entry) => entry.contribution > 0n)
    .sort((a, b) => compareDescending(a.contribution, b.contribution));

  leaderboardCache.set(key, leaderboard);
  return leaderboard;
}

async function batchGetContributions(
  seasonId: bigint,
  participants: `0x${string}`[]
): Promise<bigint[]> {
  if (participants.length === 0) return [];
  const client = getPublicClient();
  const contracts = getContracts();
  const results: bigint[] = [];
  for (let i = 0; i < participants.length; i += MULTICALL_CHUNK_SIZE) {
    const chunk = participants.slice(i, i + MULTICALL_CHUNK_SIZE);
    const chunkResults = (await client.multicall({
      allowFailure: false,
      contracts: chunk.map((participant) => ({
        ...contracts.seasonManager,
        functionName: 'getParticipantContribution',
        args: [seasonId, participant],
      })),
    })) as bigint[];
    results.push(...chunkResults);
  }
  return results;
}

/** Multi-metric leaderboard (distance, territory area, achievements) from one subgraph query; falls back to the distance-only on-chain getLeaderboard when there is no subgraph or it fails, with `usernameByWallet` supplying names the on-chain path lacks. */
export async function getWeightedLeaderboard(
  seasonId: bigint,
  participants: `0x${string}`[],
  usernameByWallet: Map<string, string>
): Promise<SubgraphLeaderboardEntry[]> {
  try {
    const fromSubgraph = await getLeaderboardFromSubgraph(seasonId);
    if (fromSubgraph) return fromSubgraph;
  } catch (e) {
    console.warn('[Season] Subgraph leaderboard fetch failed, falling back to on-chain:', e);
  }

  const entries = await getLeaderboard(seasonId, participants);
  return entries.map((e) => ({
    wallet: e.participant,
    username: usernameByWallet.get(e.participant.toLowerCase()) ?? 'Unknown',
    isVerified: false,
    distance: Number(e.contribution),
    territoryArea: 0,
    achievementCount: 0,
    score: Number(e.contribution),
  }));
}

/** Starts a season if none is active so contributions and the leaderboard have one to attach to. `startSeason` is owner-gated, so the relayer starts it. */
export async function ensureActiveSeason(
  _wallet: ReturnType<typeof getWalletClient>
): Promise<SyncedSeason> {
  const current = await getCurrentSeason();
  if (current.isActive) return current;

  const started = await relayStartSeason(30 * 24 * 60 * 60);
  if (!started.confirmed) {
    throw new Error(
      started.queued ? 'Season start is queued until you are back online' : 'Season did not start'
    );
  }
  currentSeasonCache.clear();
  return getCurrentSeason();
}

export async function recordContribution(
  _wallet: ReturnType<typeof getWalletClient>,
  participant: `0x${string}`,
  amount: number,
  activityHash: `0x${string}`
): Promise<{ confirmed: boolean }> {
  // SeasonManager only accepts contributions from its owner or allowed
  // recorders, which an ordinary user's wallet is not: the relayer writes it.
  const result = await relayRecordContribution(participant, Math.round(amount), activityHash);
  if (result.confirmed) invalidateSeasonCaches();
  return { confirmed: result.confirmed };
}
