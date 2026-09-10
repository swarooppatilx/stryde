import { keccak256, parseEventLogs, toBytes } from 'viem';
import { ACTIVITY_TYPE_MAP } from '../constants';
import type { ActivityType } from '../types';
import { getActiveConfig, getContracts, getPublicClient, type getWalletClient } from './client';
import { type ActivityMetadata, uploadJsonToIpfs } from './ipfs';

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
  const account = wallet.account?.address;
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
    activityId:
      ((event as { args?: Record<string, unknown> })?.args as { activityId?: bigint } | undefined)
        ?.activityId ?? 0n,
    txHash: hash,
    confirmed: true,
  };
}

/** Uploads an activity's off-chain metadata (name/description/photos) to
 * IPFS via this app's relay API — the on-chain ActivityRegistry record only
 * ever stores the hash/owner/timestamp (see recordActivity above), so this
 * richer data needs a place to live that isn't purely on-device AsyncStorage
 * if it's going to survive logout or a device switch. */
export async function uploadActivityMetadata(
  metadata: ActivityMetadata
): Promise<{ cid: string; size: number }> {
  return uploadJsonToIpfs(`activity-metadata-${Date.now()}`, metadata as Record<string, unknown>);
}

/** Attaches a previously-uploaded metadata CID to an on-chain activity via
 * the additive `setActivityMetadata` function on ActivityRegistry. This is a
 * brand new function on the already-deployed contract — it does NOT touch
 * recordActivity's signature or behavior, so existing callers of
 * recordActivity are unaffected. Only the activity's own owner may call this
 * (enforced on-chain); mirrors ProfileRegistry's setAvatar/AvatarUpdated
 * pattern (a setter that just emits an event for the subgraph to index). */
export async function setActivityMetadata(
  wallet: ReturnType<typeof getWalletClient>,
  activityId: bigint,
  metadataCid: string
): Promise<{ txHash: `0x${string}`; confirmed: boolean }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.activityRegistry,
    functionName: 'setActivityMetadata',
    args: [activityId, metadataCid],
    account,
    chain: config.chain,
  });

  const client = getPublicClient();
  const receipt = await client.waitForTransactionReceipt({ hash });
  return { txHash: hash, confirmed: receipt.status === 'success' };
}

/** Convenience wrapper for the common create-activity flow: uploads
 * name/description/photos to IPFS, then attaches the resulting CID on-chain.
 * Returns null (rather than throwing) when there's no metadata worth
 * persisting, and lets IPFS/on-chain failures propagate to the caller, which
 * should treat this as best-effort — the activity itself is already recorded
 * via recordActivity by the time this runs, so a failure here should not be
 * treated as the activity having failed to save. */
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
