import { parseEventLogs, zeroAddress } from 'viem';
import { ACTIVITY_TYPE_BY_ID, ACTIVITY_TYPE_MAP } from '../constants';
import type { ActivityType } from '../types';
import { createTtlCache } from './cache';
import { getChainMode, getContracts, getPublicClient, type getWalletClient } from './client';
import { scanLogWindows } from './logScan';
import { relaySettleChallenge } from './relay';
import { syncActivitiesFromChain } from './sync';
import { writeAndConfirm } from './tx';

const WINNER_CACHE_TTL_MS = 30 * 1000;
const winnerCache = createTtlCache<`0x${string}` | null>(WINNER_CACHE_TTL_MS);

export const ChallengeStatus = {
  Open: 0,
  Accepted: 1,
  Settled: 2,
  Cancelled: 3,
} as const;
export type ChallengeStatusValue = (typeof ChallengeStatus)[keyof typeof ChallengeStatus];

export interface OnchainChallenge {
  id: bigint;
  challenger: `0x${string}`;
  opponent: `0x${string}`;
  stake: bigint;
  activityType: number;
  targetMetric: bigint;
  deadline: number;
  winner: `0x${string}`;
  status: ChallengeStatusValue;
}

interface RawChallenge {
  challenger: `0x${string}`;
  opponent: `0x${string}`;
  stake: bigint;
  activityType: number;
  targetMetric: bigint;
  deadline: bigint;
  winner: `0x${string}`;
  status: number;
}

/** Reads one challenge, or null if the registry never issued the id. A missing id returns a zeroed struct (Solidity's default mapping value), not a revert, so existence is checked via the challenger: otherwise callers render a phantom "0x0000… vs 0m" challenge. */
export async function getChallenge(challengeId: bigint): Promise<OnchainChallenge | null> {
  const client = getPublicClient();
  const contracts = getContracts();
  const raw = (await client.readContract({
    ...contracts.challengeRegistry,
    functionName: 'getChallenge',
    args: [challengeId],
  })) as RawChallenge;

  if (raw.challenger === zeroAddress) return null;

  return {
    id: challengeId,
    challenger: raw.challenger,
    opponent: raw.opponent,
    stake: raw.stake,
    activityType: raw.activityType,
    targetMetric: raw.targetMetric,
    deadline: Number(raw.deadline),
    winner: raw.winner,
    status: raw.status as ChallengeStatusValue,
  };
}

export async function getUserChallengeIds(
  user: `0x${string}`,
  offset = 0n,
  limit = 100n
): Promise<readonly bigint[]> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.challengeRegistry,
    functionName: 'getUserChallenges',
    args: [user, BigInt(offset), BigInt(limit)],
  });
}

export async function getUserChallenges(user: `0x${string}`): Promise<OnchainChallenge[]> {
  const ids = await getUserChallengeIds(user);
  const challenges = await Promise.all(ids.map((id) => getChallenge(id)));
  // Ids come from the registry, so they exist — but drop a zeroed entry rather than put
  // a phantom in someone's challenge list.
  return challenges.filter((challenge): challenge is OnchainChallenge => challenge !== null);
}

export async function createChallenge(
  wallet: ReturnType<typeof getWalletClient>,
  params: {
    opponent: `0x${string}`;
    activityType: ActivityType;
    targetMetric: number;
    durationSeconds: number;
    stakeWei: bigint;
  }
): Promise<{ challengeId: bigint; confirmed: boolean }> {
  const contracts = getContracts();

  const { confirmed, receipt } = await writeAndConfirm(wallet, 'challengeRegistry', {
    functionName: 'createChallenge',
    args: [
      params.opponent,
      ACTIVITY_TYPE_MAP[params.activityType],
      BigInt(Math.round(params.targetMetric)),
      BigInt(Math.round(params.durationSeconds)),
    ],
    value: params.stakeWei,
  });
  if (!confirmed) {
    return { challengeId: 0n, confirmed: false };
  }

  // Read the id from this tx's own ChallengeCreated event rather than the global
  // getChallengeCount() — a concurrent createChallenge would shift that counter
  // and hand back a stranger's challenge.
  const [event] = parseEventLogs({
    abi: contracts.challengeRegistry.abi,
    eventName: 'ChallengeCreated',
    logs: receipt.logs,
  });

  const challengeId = event?.args.challengeId ?? 0n;
  return { challengeId, confirmed: true };
}

export async function acceptChallenge(
  wallet: ReturnType<typeof getWalletClient>,
  challengeId: bigint,
  stakeWei: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const { txHash, confirmed } = await writeAndConfirm(wallet, 'challengeRegistry', {
    functionName: 'acceptChallenge',
    args: [challengeId],
    value: stakeWei,
  });
  return { confirmed, txHash };
}

/** Picks a winner by comparing each participant's recorded distance between creation and deadline from their ActivityRecorded logs. Only used to tell the athlete whether there is anything to settle; the relayer decides the winner itself. */
/** When the challenge began: the timestamp of the block that created it (0 if its log can't be found). */
async function challengeStart(challenge: OnchainChallenge): Promise<number> {
  const client = getPublicClient();
  const contracts = getContracts();

  const createdLogs = await scanLogWindows((fromBlock, toBlock) =>
    client.getLogs({
      address: contracts.challengeRegistry.address,
      event: {
        type: 'event',
        name: 'ChallengeCreated',
        inputs: [
          { type: 'uint256', name: 'challengeId', indexed: true },
          { type: 'address', name: 'challenger', indexed: true },
          { type: 'address', name: 'opponent', indexed: true },
          { type: 'uint8', name: 'activityType', indexed: false },
          { type: 'uint256', name: 'targetMetric', indexed: false },
          { type: 'uint256', name: 'deadline', indexed: false },
          { type: 'uint256', name: 'stake', indexed: false },
        ],
      },
      args: { challengeId: challenge.id },
      fromBlock,
      toBlock,
    })
  );

  const createdBlock = createdLogs[0]?.blockNumber;
  if (createdBlock === undefined) return 0;
  const block = await client.getBlock({ blockNumber: createdBlock });
  return Number(block.timestamp);
}

/** How far each side has gone so far, in the challenge's sport and inside its window (meters). */
export async function getChallengeStandings(
  challenge: OnchainChallenge
): Promise<{ challenger: number; opponent: number }> {
  const startTimestamp = await challengeStart(challenge);
  const [challengerActivities, opponentActivities] = await Promise.all([
    syncActivitiesFromChain(challenge.challenger),
    syncActivitiesFromChain(challenge.opponent),
  ]);

  // A run challenge is not won by cycling. An unknown sport id counts everything.
  const sport = ACTIVITY_TYPE_BY_ID[challenge.activityType];
  const sumDistance = (activities: Awaited<ReturnType<typeof syncActivitiesFromChain>>) =>
    activities
      .filter((a) => a.timestamp >= startTimestamp && a.timestamp <= challenge.deadline)
      .filter((a) => !sport || a.activityType === sport)
      .reduce((sum, a) => sum + a.distance, 0);

  return {
    challenger: sumDistance(challengerActivities),
    opponent: sumDistance(opponentActivities),
  };
}

export async function determineWinner(challenge: OnchainChallenge): Promise<`0x${string}` | null> {
  const key = `${getChainMode()}:${challenge.id.toString()}`;
  const cached = winnerCache.get(key);
  if (cached !== undefined) return cached;

  const { challenger, opponent } = await getChallengeStandings(challenge);
  let winner: `0x${string}` | null;
  if (challenger === opponent) {
    winner = null;
  } else {
    winner = challenger > opponent ? challenge.challenger : challenge.opponent;
  }
  winnerCache.set(key, winner);
  return winner;
}

/** Asks the relayer to settle a challenge after its deadline. Only the contract's settler may, and it names the winner itself. */
export async function settleChallenge(
  challengeId: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const result = await relaySettleChallenge(challengeId);
  return { confirmed: result.confirmed, txHash: result.hash };
}

export async function cancelChallenge(
  wallet: ReturnType<typeof getWalletClient>,
  challengeId: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const { txHash, confirmed } = await writeAndConfirm(wallet, 'challengeRegistry', {
    functionName: 'cancelChallenge',
    args: [challengeId],
  });
  return { confirmed, txHash };
}

export async function withdrawStake(
  wallet: ReturnType<typeof getWalletClient>,
  challengeId: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const { txHash, confirmed } = await writeAndConfirm(wallet, 'challengeRegistry', {
    functionName: 'withdrawStake',
    args: [challengeId],
  });
  return { confirmed, txHash };
}
