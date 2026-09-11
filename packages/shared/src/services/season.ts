import { createTtlCache } from './cache';
import {
  getActiveConfig,
  getChainMode,
  getContracts,
  getPublicClient,
  type getWalletClient,
} from './client';
import { relayStartSeason } from './relay';

const THIRTY_DAYS_SECONDS = 30n * 24n * 60n * 60n;
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
  const key = `${seasonId.toString()}:${participant.toLowerCase()}`;
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
  const key = `${seasonId.toString()}:${participants
    .map((p) => p.toLowerCase())
    .sort()
    .join(',')}`;
  const cached = leaderboardCache.get(key);
  if (cached !== undefined) return cached;

  const contributions = await batchGetContributions(seasonId, participants);

  const leaderboard = participants
    .map((participant, i) => ({ participant, contribution: contributions[i] ?? 0n }))
    .filter((entry) => entry.contribution > 0n)
    .sort((a, b) =>
      b.contribution > a.contribution ? 1 : a.contribution > b.contribution ? -1 : 0
    );

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

/**
 * Starts a season if none is currently active, so there's always something for
 * `recordContribution`/the leaderboard to attach to. `startSeason` is owner-gated
 * on-chain — this only succeeds in local dev, where every user shares the deployer
 * (owner) account. A real deployment needs an explicit admin action instead.
 */
export async function ensureActiveSeason(
  wallet: ReturnType<typeof getWalletClient>
): Promise<SyncedSeason> {
  const current = await getCurrentSeason();
  if (current.isActive) return current;

  if (getChainMode() !== 'local') {
    await relayStartSeason(30 * 24 * 60 * 60);
    currentSeasonCache.clear();
    return getCurrentSeason();
  }

  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.seasonManager,
    functionName: 'startSeason',
    args: [THIRTY_DAYS_SECONDS],
    account,
    chain: config.chain,
  });
  await client.waitForTransactionReceipt({ hash });

  currentSeasonCache.clear();
  return getCurrentSeason();
}

export async function recordContribution(
  wallet: ReturnType<typeof getWalletClient>,
  participant: `0x${string}`,
  amount: number
): Promise<{ confirmed: boolean }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.seasonManager,
    functionName: 'recordContribution',
    args: [participant, BigInt(Math.round(amount))],
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status === 'success') {
    invalidateSeasonCaches();
  }
  return { confirmed: receipt.status === 'success' };
}
