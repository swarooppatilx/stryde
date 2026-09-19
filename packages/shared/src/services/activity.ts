import { keccak256, parseEventLogs, toBytes } from 'viem';
import { ACTIVITY_TYPE_MAP } from '../constants';
import type { ActivityType } from '../types';
import { getContracts, getPublicClient, type getWalletClient } from './client';
import { type ActivityMetadata, uploadJsonToIpfs } from './ipfs';
import { writeAndConfirm } from './tx';

export async function getActivityHash(activityId: bigint): Promise<`0x${string}`> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.activityRegistry,
    functionName: 'getActivityHash',
    args: [activityId],
  });
}

export async function getActivityOwner(activityId: bigint): Promise<`0x${string}`> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.activityRegistry,
    functionName: 'getActivityOwner',
    args: [activityId],
  });
}

export async function getActivityTimestamp(activityId: bigint): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.activityRegistry,
    functionName: 'getActivityTimestamp',
    args: [activityId],
  });
}

export async function getActivityCount(user: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.activityRegistry,
    functionName: 'getActivityCount',
    args: [user],
  });
}

export async function totalActivities(): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.activityRegistry,
    functionName: 'totalActivities',
  });
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

  const activityHash = computeActivityHash(
    params.polyline,
    params.territoryArea,
    params.metadata || ''
  );

  const activityTypeId = ACTIVITY_TYPE_MAP[params.activityType];

  const { txHash, confirmed, receipt } = await writeAndConfirm(wallet, 'activityRegistry', {
    functionName: 'recordActivity',
    args: [
      activityHash,
      activityTypeId,
      BigInt(Math.round(params.distance)),
      BigInt(Math.round(params.duration)),
      BigInt(Math.round(params.territoryArea)),
    ],
  });
  if (!confirmed) {
    return { activityId: 0n, txHash, confirmed: false };
  }

  const [event] = parseEventLogs({
    abi: contracts.activityRegistry.abi,
    eventName: 'ActivityRecorded',
    logs: receipt.logs,
  });

  return {
    activityId: event?.args.activityId ?? 0n,
    txHash,
    confirmed: true,
  };
}

/** Uploads an activity's off-chain metadata (name/description/photos) to IPFS via the relay API; on-chain ActivityRegistry stores only hash/owner/timestamp. */
export async function uploadActivityMetadata(
  metadata: ActivityMetadata
): Promise<{ cid: string; size: number }> {
  return uploadJsonToIpfs(`activity-metadata-${Date.now()}`, metadata as Record<string, unknown>);
}

/** Attaches an uploaded metadata CID to an on-chain activity via `setActivityMetadata`; owner-only on-chain, and it emits an event for the subgraph like ProfileRegistry's setAvatar. */
export async function setActivityMetadata(
  wallet: ReturnType<typeof getWalletClient>,
  activityId: bigint,
  metadataCid: string
): Promise<{ txHash: `0x${string}`; confirmed: boolean }> {
  const { txHash, confirmed } = await writeAndConfirm(wallet, 'activityRegistry', {
    functionName: 'setActivityMetadata',
    args: [activityId, metadataCid],
  });
  return { txHash, confirmed };
}

/** Uploads name/description/photos to IPFS and attaches the CID on-chain; null when there is no metadata worth persisting. IPFS and on-chain failures propagate; callers should treat them as best-effort since the activity is already recorded. */
export async function uploadAndSetActivityMetadata(
  wallet: ReturnType<typeof getWalletClient>,
  activityId: bigint,
  metadata: ActivityMetadata
): Promise<{ cid: string; txHash: `0x${string}`; confirmed: boolean } | null> {
  const hasMetadata =
    !!metadata.name?.trim() || !!metadata.description?.trim() || !!metadata.photos?.length;
  if (!hasMetadata) return null;

  const { cid } = await uploadActivityMetadata(metadata);
  const { txHash, confirmed } = await setActivityMetadata(wallet, activityId, cid);
  return { cid, txHash, confirmed };
}
