import { getActiveConfig, getContracts, getPublicClient, type getWalletClient } from './client';

const THIRTY_DAYS_SECONDS = 30n * 24n * 60n * 60n;

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

export async function getCurrentSeason(): Promise<SyncedSeason> {
  const client = getPublicClient();
  const contracts = getContracts();
  const raw = (await client.readContract({
    ...contracts.seasonManager,
    functionName: 'getCurrentSeason',
  })) as RawSeason;
  return toSyncedSeason(raw);
}

export async function getParticipantContribution(
  seasonId: bigint,
  participant: `0x${string}`
): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.seasonManager,
    functionName: 'getParticipantContribution',
    args: [seasonId, participant],
  }) as Promise<bigint>;
}

export interface LeaderboardEntry {
  participant: `0x${string}`;
  contribution: bigint;
}

export async function getLeaderboard(
  seasonId: bigint,
  participants: `0x${string}`[]
): Promise<LeaderboardEntry[]> {
  const contributions = await Promise.all(
    participants.map((p) => getParticipantContribution(seasonId, p))
  );

  return participants
    .map((participant, i) => ({ participant, contribution: contributions[i] ?? 0n }))
    .filter((entry) => entry.contribution > 0n)
    .sort((a, b) =>
      b.contribution > a.contribution ? 1 : a.contribution > b.contribution ? -1 : 0
    );
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
  return { confirmed: receipt.status === 'success' };
}
