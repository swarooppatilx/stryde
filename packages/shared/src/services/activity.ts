import { keccak256, parseEventLogs, toBytes } from 'viem';
import { ACTIVITY_TYPE_MAP } from '../constants';
import type { ActivityType } from '../types';
import { getActiveConfig, getContracts, getPublicClient, type getWalletClient } from './client';

export async function getActivityHash(activityId: bigint): Promise<`0x${string}`> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.activityRegistry,
    functionName: 'getActivityHash',
    args: [activityId],
  }) as Promise<`0x${string}`>;
}

export async function getActivityOwner(activityId: bigint): Promise<`0x${string}`> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.activityRegistry,
    functionName: 'getActivityOwner',
    args: [activityId],
  }) as Promise<`0x${string}`>;
}

export async function getActivityTimestamp(activityId: bigint): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.activityRegistry,
    functionName: 'getActivityTimestamp',
    args: [activityId],
  }) as Promise<bigint>;
}

export async function getActivityCount(user: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.activityRegistry,
    functionName: 'getActivityCount',
    args: [user],
  }) as Promise<bigint>;
}

export async function getUserActivityIds(user: `0x${string}`): Promise<bigint[]> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.activityRegistry,
    functionName: 'getUserActivityIds',
    args: [user],
  }) as Promise<bigint[]>;
}

export async function totalActivities(): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.activityRegistry,
    functionName: 'totalActivities',
  }) as Promise<bigint>;
}

export function computeActivityHash(
  polyline: string,
  territoryArea: number,
  metadata: string
): `0x${string}` {
  const data = `${polyline}:${territoryArea}:${metadata}`;
  return keccak256(toBytes(data));
}

export async function recordActivity(
  wallet: ReturnType<typeof getWalletClient>,
  params: {
    polyline: string;
    activityType: ActivityType;
    distance: number;
    duration: number;
    territoryArea: number;
    metadata?: string;
  }
): Promise<{ activityId: bigint; txHash: `0x${string}`; confirmed: boolean }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const addresses = await wallet.getAddresses();
  const account = addresses[0];
  if (!account) throw new Error('No wallet account found');

  const activityHash = computeActivityHash(
    params.polyline,
    params.territoryArea,
    params.metadata || ''
  );

  const activityTypeId = ACTIVITY_TYPE_MAP[params.activityType];

  const hash = await wallet.writeContract({
    ...contracts.activityRegistry,
    functionName: 'recordActivity',
    args: [
      activityHash,
      activityTypeId,
      BigInt(Math.round(params.distance)),
      BigInt(Math.round(params.duration)),
      BigInt(Math.round(params.territoryArea)),
    ],
    account,
    chain: config.chain,
  });

  const client = getPublicClient();
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    return { activityId: 0n, txHash: hash, confirmed: false };
  }

  const [event] = parseEventLogs({
    abi: contracts.activityRegistry.abi,
    eventName: 'ActivityRecorded',
    logs: receipt.logs,
  });

  return {
    activityId: (event?.args as { activityId?: bigint } | undefined)?.activityId ?? 0n,
    txHash: hash,
    confirmed: true,
  };
}
