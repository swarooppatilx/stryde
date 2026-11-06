import { decodeEventLog } from 'viem';
import { ACTIVITY_TYPE_BY_ID } from '../constants';
import type { ActivityType } from '../types';
import { getActivitySummaries } from './activitySummaries';
import { getContracts, getPublicClient } from './client';
import { type ActivityMetadata, fetchJsonFromIpfs } from './ipfs';
import { scanFeedLogWindows } from './logScan';
import { getActivitiesFromSubgraph } from './subgraph';

export interface SyncedActivity {
  activityHash: string;
  owner: string;
  activityId: bigint;
  activityType: ActivityType;
  distance: number;
  duration: number;
  territoryArea: number;
  timestamp: number;
  metadata: string;
  /** IPFS CID set via ActivityRegistry.setActivityMetadata, if the owner attached off-chain metadata. */
  metadataCid?: string;
  /** Populated from `metadataCid` (see hydrateActivityMetadata) so chain-synced activities on a new device show their real name/description/photos. */
  metadataName?: string;
  metadataDescription?: string;
  metadataPhotos?: string[];
  metadataPolyline?: string;
  metadataTerritory?: ActivityMetadata['territory'];
  metadataMuted?: boolean;
  metadataHiddenStats?: string[];
}

export interface SyncedTerritory {
  id: string;
  controller: string;
  capturedAt: number;
  lastReinforced: number;
  controlStrength: number;
  areaSqm: number;
  polygonHash: string;
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface SyncedProfile {
  isRegistered: boolean;
  profileId: bigint | null;
}

const ACTIVITY_RECORDED_EVENT = {
  type: 'event',
  name: 'ActivityRecorded',
  inputs: [
    { type: 'uint256', name: 'activityId', indexed: true },
    { type: 'address', name: 'owner', indexed: true },
    { type: 'bytes32', name: 'activityHash', indexed: true },
    { type: 'uint8', name: 'activityType', indexed: false },
    { type: 'uint256', name: 'distance', indexed: false },
    { type: 'uint256', name: 'duration', indexed: false },
    { type: 'uint256', name: 'timestamp', indexed: false },
    { type: 'uint256', name: 'territoryArea', indexed: false },
  ],
} as const;

const ACTIVITY_METADATA_UPDATED_EVENT = {
  type: 'event',
  name: 'ActivityMetadataUpdated',
  inputs: [
    { type: 'uint256', name: 'activityId', indexed: true },
    { type: 'address', name: 'owner', indexed: true },
    { type: 'string', name: 'metadataCid', indexed: false },
  ],
} as const;

/** getLogs fallback for modes with no subgraph or when its query fails; returns activityId -> latest metadataCid (last write wins). */
async function fetchActivityMetadataCids(
  client: ReturnType<typeof getPublicClient>,
  contracts: ReturnType<typeof getContracts>,
  owner?: `0x${string}`
): Promise<Map<string, string>> {
  const byActivityId = new Map<string, string>();
  try {
    const logs = await scanFeedLogWindows((fromBlock, toBlock) =>
      client.getLogs({
        address: contracts.activityRegistry.address,
        event: ACTIVITY_METADATA_UPDATED_EVENT,
        args: owner ? { owner } : undefined,
        fromBlock,
        toBlock,
      })
    );

    for (const log of logs) {
      const { args } = decodeEventLog({
        abi: [ACTIVITY_METADATA_UPDATED_EVENT],
        data: log.data,
        topics: log.topics,
      });
      const a = args;
      byActivityId.set(a.activityId.toString(), a.metadataCid);
    }
  } catch (error) {
    console.warn('[sync] fetchActivityMetadataCids: getLogs failed', error);
  }
  return byActivityId;
}

function withMetadataCids(
  activities: SyncedActivity[],
  cidsByActivityId: Map<string, string>
): SyncedActivity[] {
  if (cidsByActivityId.size === 0) return activities;
  return activities.map((a) => {
    const cid = cidsByActivityId.get(a.activityId.toString());
    return cid ? { ...a, metadataCid: cid } : a;
  });
}

/** Gateway fetches running at once; a feed of 60 athletes' runs must not open 60 connections. */
const IPFS_CONCURRENCY = 5;

/** Runs `task` over `items` with at most `limit` in flight at a time. */
async function mapLimited<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0;
  async function worker() {
    while (next < items.length) await task(items[next++] as T);
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Resolves each activity's `metadataCid` to its off-chain name/description/photos/route. The Arkiv index
 * has usually read them already, so one request covers the feed; only CIDs it did not cover go to IPFS,
 * a few at a time. Best-effort: a failed fetch leaves that activity's fields unset.
 */
export async function hydrateActivityMetadata(
  activities: SyncedActivity[]
): Promise<SyncedActivity[]> {
  const cids = Array.from(
    new Set(activities.map((a) => a.metadataCid).filter((cid): cid is string => !!cid))
  );
  if (cids.length === 0) return activities;

  const metadataByCid = new Map<string, ActivityMetadata | null>(
    (await getActivitySummaries()) ?? []
  );
  await mapLimited(
    cids.filter((cid) => !metadataByCid.has(cid)),
    IPFS_CONCURRENCY,
    async (cid) => {
      metadataByCid.set(cid, await fetchJsonFromIpfs<ActivityMetadata>(cid));
    }
  );

  return activities.map((a) => {
    if (!a.metadataCid) return a;
    const metadata = metadataByCid.get(a.metadataCid);
    if (!metadata) return a;
    return {
      ...a,
      metadataName: metadata.name,
      metadataDescription: metadata.description,
      metadataPhotos: metadata.photos,
      metadataPolyline: metadata.polyline,
      metadataTerritory: metadata.territory,
      metadataMuted: metadata.mutedFromFeeds === true ? true : undefined,
      metadataHiddenStats: metadata.hiddenStats?.length ? metadata.hiddenStats : undefined,
    };
  });
}

async function fetchActivityRecordedLogs(
  client: ReturnType<typeof getPublicClient>,
  contracts: ReturnType<typeof getContracts>,
  owner?: `0x${string}`
): Promise<SyncedActivity[]> {
  const logs = await scanFeedLogWindows((fromBlock, toBlock) =>
    client.getLogs({
      address: contracts.activityRegistry.address,
      event: ACTIVITY_RECORDED_EVENT,
      args: owner ? { owner } : undefined,
      fromBlock,
      toBlock,
    })
  );

  return logs.map((log) => {
    const { args } = decodeEventLog({
      abi: [ACTIVITY_RECORDED_EVENT],
      data: log.data,
      topics: log.topics,
    });
    const a = args;

    const activityType: ActivityType = ACTIVITY_TYPE_BY_ID[a.activityType] ?? 'run';

    return {
      activityHash: a.activityHash,
      owner: a.owner,
      activityId: a.activityId,
      activityType,
      distance: Number(a.distance),
      duration: Number(a.duration),
      territoryArea: Number(a.territoryArea),
      timestamp: Number(a.timestamp),
      metadata: '',
    } satisfies SyncedActivity;
  });
}

/** One participant's recorded activity history (e.g. to settle a challenge); subgraph first (filtered by wallet), else scans ActivityRecorded logs. */
export async function syncActivitiesFromChain(wallet: `0x${string}`): Promise<SyncedActivity[]> {
  try {
    const fromSubgraph = await getActivitiesFromSubgraph(wallet);
    if (fromSubgraph) {
      const hydrated = await hydrateActivityMetadata(fromSubgraph);
      return hydrated.sort((a, b) => (b.activityId > a.activityId ? 1 : -1));
    }
  } catch {
    // fall through to the on-chain scan below
  }

  const client = getPublicClient();
  const contracts = getContracts();

  try {
    const activities = await fetchActivityRecordedLogs(client, contracts, wallet);
    const metadataCids = await fetchActivityMetadataCids(client, contracts, wallet);
    const hydrated = await hydrateActivityMetadata(withMetadataCids(activities, metadataCids));
    return hydrated.sort((a, b) => (b.activityId > a.activityId ? 1 : -1));
  } catch (error) {
    console.warn(
      `[sync] syncActivitiesFromChain: getLogs fallback failed for wallet ${wallet}`,
      error
    );
    throw error;
  }
}

/** Every recorded activity across users for the social feed; subgraph first, else scans ActivityRecorded logs. */
export async function syncAllActivitiesFromChain(): Promise<SyncedActivity[]> {
  try {
    const fromSubgraph = await getActivitiesFromSubgraph();
    if (fromSubgraph) {
      const hydrated = await hydrateActivityMetadata(fromSubgraph);
      return hydrated.sort((a, b) => (b.activityId > a.activityId ? 1 : -1));
    }
  } catch (e) {
    console.warn('[Sync] Subgraph fetch failed, falling back to on-chain scan:', e);
  }

  const client = getPublicClient();
  const contracts = getContracts();

  try {
    const activities = await fetchActivityRecordedLogs(client, contracts);
    const metadataCids = await fetchActivityMetadataCids(client, contracts);
    const hydrated = await hydrateActivityMetadata(withMetadataCids(activities, metadataCids));
    return hydrated.sort((a, b) => (b.activityId > a.activityId ? 1 : -1));
  } catch (e) {
    console.warn('[Sync] Failed to sync all activities from chain:', e);
    throw e;
  }
}

export async function syncTerritoriesFromChain(wallet: `0x${string}`): Promise<SyncedTerritory[]> {
  const client = getPublicClient();
  const contracts = getContracts();

  let territoryIds: `0x${string}`[];
  try {
    territoryIds = (await client.readContract({
      ...contracts.territoryRegistry,
      functionName: 'getUserTerritories',
      args: [wallet],
    })) as `0x${string}`[];
  } catch (e) {
    console.warn('[Sync] Failed to fetch territory IDs:', e);
    throw e;
  }

  // Multicall3 where the chain has it (Sepolia); plain parallel reads otherwise, since local Anvil has none and viem's multicall would throw.
  const calls = territoryIds.map((id) => ({
    ...contracts.territoryRegistry,
    functionName: 'getTerritory' as const,
    args: [id] as const,
  }));
  const results: Array<
    { status: 'success'; result: unknown } | { status: 'failure'; error: unknown }
  > = client.chain?.contracts?.multicall3
    ? await client.multicall({ allowFailure: true, contracts: calls })
    : (await Promise.allSettled(calls.map((c) => client.readContract(c)))).map((r) =>
        r.status === 'fulfilled'
          ? { status: 'success' as const, result: r.value }
          : { status: 'failure' as const, error: r.reason }
      );

  return results.map((callResult, i): SyncedTerritory => {
    // A partial list would be taken as the full set and drop this territory from the app.
    if (callResult.status === 'failure') throw callResult.error;
    const t = callResult.result as {
      controller: `0x${string}`;
      capturedAt: bigint;
      lastReinforced: bigint;
      controlStrength: bigint;
      areaSqm: bigint;
      polygonHash: `0x${string}`;
      minLng: number;
      minLat: number;
      maxLng: number;
      maxLat: number;
    };

    return {
      id: territoryIds[i] as string,
      controller: t.controller,
      capturedAt: Number(t.capturedAt),
      lastReinforced: Number(t.lastReinforced),
      controlStrength: Number(t.controlStrength),
      areaSqm: Number(t.areaSqm),
      polygonHash: t.polygonHash,
      minLng: t.minLng,
      minLat: t.minLat,
      maxLng: t.maxLng,
      maxLat: t.maxLat,
    } as SyncedTerritory;
  });
}

/**
 * Reads the wallet's profile id. A wallet without a profile is a normal
 * answer ({ isRegistered: false }); a failed read throws, so callers can tell
 * "not registered" from "couldn't check".
 */
export async function syncProfileFromChain(wallet: `0x${string}`): Promise<SyncedProfile> {
  const client = getPublicClient();
  const contracts = getContracts();

  const isRegistered = (await client.readContract({
    ...contracts.profileRegistry,
    functionName: 'isRegistered',
    args: [wallet],
  })) as boolean;
  if (!isRegistered) return { isRegistered: false, profileId: null };

  const profileId = (await client.readContract({
    ...contracts.profileRegistry,
    functionName: 'getProfileId',
    args: [wallet],
  })) as bigint;
  return { isRegistered: true, profileId };
}
