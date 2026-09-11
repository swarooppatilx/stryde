import { parseEventLogs } from 'viem';
import { ACTIVITY_TYPE_MAP } from '../constants';
import type { ActivityType } from '../types';
import { createTtlCache } from './cache';
import { getActiveConfig, getContracts, getPublicClient, type getWalletClient } from './client';
import { syncActivitiesFromChain } from './sync';

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

export async function getChallenge(challengeId: bigint): Promise<OnchainChallenge> {
  const client = getPublicClient();
  const contracts = getContracts();
  const raw = (await client.readContract({
    ...contracts.challengeRegistry,
    functionName: 'getChallenge',
    args: [challengeId],
  })) as RawChallenge;

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
): Promise<bigint[]> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.challengeRegistry,
    functionName: 'getUserChallenges',
    args: [user, BigInt(offset), BigInt(limit)],
  }) as Promise<bigint[]>;
}

export async function getUserChallenges(user: `0x${string}`): Promise<OnchainChallenge[]> {
  const ids = await getUserChallengeIds(user);
  return Promise.all(ids.map((id) => getChallenge(id)));
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
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.challengeRegistry,
    functionName: 'createChallenge',
    args: [
      params.opponent,
      ACTIVITY_TYPE_MAP[params.activityType],
      BigInt(Math.round(params.targetMetric)),
      BigInt(Math.round(params.durationSeconds)),
    ],
    value: params.stakeWei,
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
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

  const challengeId =
    ((event as { args?: Record<string, unknown> })?.args as { challengeId?: bigint } | undefined)
      ?.challengeId ?? 0n;
  return { challengeId, confirmed: true };
}

export async function acceptChallenge(
  wallet: ReturnType<typeof getWalletClient>,
  challengeId: bigint,
  stakeWei: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.challengeRegistry,
    functionName: 'acceptChallenge',
    args: [challengeId],
    value: stakeWei,
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  return { confirmed: receipt.status === 'success', txHash: hash };
}

/**
 * Compares each participant's recorded activity distance between the challenge's
 * creation and its deadline to pick a winner. There's no backend/subgraph yet, so
 * this reads straight from each participant's ActivityRecorded logs — whoever calls
 * `settleChallenge` submits the result, since settlement itself is permissionless.
 */
export async function determineWinner(challenge: OnchainChallenge): Promise<`0x${string}` | null> {
  const key = challenge.id.toString();
  const cached = winnerCache.get(key);
  if (cached !== undefined) return cached;

  const client = getPublicClient();
  const contracts = getContracts();

  const createdLogs = await client.getLogs({
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
    fromBlock: 0n,
    toBlock: 'latest',
  });

  const createdBlock = createdLogs[0]?.blockNumber;
  let startTimestamp = 0;
  if (createdBlock !== undefined) {
    const block = await client.getBlock({ blockNumber: createdBlock });
    startTimestamp = Number(block.timestamp);
  }

  const [challengerActivities, opponentActivities] = await Promise.all([
    syncActivitiesFromChain(challenge.challenger),
    syncActivitiesFromChain(challenge.opponent),
  ]);

  const sumDistance = (activities: Awaited<ReturnType<typeof syncActivitiesFromChain>>) =>
    activities
      .filter((a) => a.timestamp >= startTimestamp && a.timestamp <= challenge.deadline)
      .reduce((sum, a) => sum + a.distance, 0);

  const challengerDistance = sumDistance(challengerActivities);
  const opponentDistance = sumDistance(opponentActivities);

  let winner: `0x${string}` | null;
  if (challengerDistance === opponentDistance) {
    winner = null;
  } else {
    winner = challengerDistance > opponentDistance ? challenge.challenger : challenge.opponent;
  }
  winnerCache.set(key, winner);
  return winner;
}

export async function settleChallenge(
  wallet: ReturnType<typeof getWalletClient>,
  challengeId: bigint,
  winner: `0x${string}`
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.challengeRegistry,
    functionName: 'settleChallenge',
    args: [challengeId, winner],
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  return { confirmed: receipt.status === 'success', txHash: hash };
}

export async function cancelChallenge(
  wallet: ReturnType<typeof getWalletClient>,
  challengeId: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.challengeRegistry,
    functionName: 'cancelChallenge',
    args: [challengeId],
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  return { confirmed: receipt.status === 'success', txHash: hash };
}

export async function withdrawStake(
  wallet: ReturnType<typeof getWalletClient>,
  challengeId: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.challengeRegistry,
    functionName: 'withdrawStake',
    args: [challengeId],
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  return { confirmed: receipt.status === 'success', txHash: hash };
}
