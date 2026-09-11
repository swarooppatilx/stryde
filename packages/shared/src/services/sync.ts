import { decodeEventLog } from 'viem';
import { ACTIVITY_TYPE_BY_ID } from '../constants';
import type { ActivityType } from '../types';
import { getContracts, getPublicClient } from './client';
import { type ActivityMetadata, fetchJsonFromIpfs } from './ipfs';
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
  /** IPFS CID set via ActivityRegistry.setActivityMetadata, if the owner has
   * attached off-chain metadata (name/description/photos) to this activity. */
  metadataCid?: string;
  /** Populated from `metadataCid` (see hydrateActivityMetadata below) so
   * activities synced fresh from the chain — e.g. a new device, or after
   * logout — can show their real name/description/photos instead of the
   * blank fields a purely local-AsyncStorage record would have. */
  metadataName?: string;
  metadataDescription?: string;
  metadataPhotos?: string[];
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

/** Only reached for chain modes with no subgraph configured (e.g. local
 * Anvil) or when the subgraph query itself fails — mirrors the getLogs
 * fallback pattern used for ActivityRecorded above and for ProfileRegistry's
 * AvatarUpdated in services/profile.ts. Returns activityId -> latest
 * metadataCid, last write wins. */
async function fetchActivityMetadataCids(
  client: ReturnType<typeof getPublicClient>,
  contracts: ReturnType<typeof getContracts>,
  owner?: `0x${string}`
): Promise<Map<string, string>> {
  const byActivityId = new Map<string, string>();
  try {
    const logs = await client.getLogs({
      address: contracts.activityRegistry.address,
      event: ACTIVITY_METADATA_UPDATED_EVENT,
      args: owner ? { owner } : undefined,
      fromBlock: 0n,
      toBlock: 'latest',
    });

    for (const log of logs) {
      const { args } = decodeEventLog({
        abi: [ACTIVITY_METADATA_UPDATED_EVENT],
        data: log.data,
        topics: log.topics,
      });
      const a = args as unknown as {
        activityId: bigint;
        owner: `0x${string}`;
        metadataCid: string;
      };
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

/** Resolves each activity's `metadataCid` (if any) to its off-chain
 * name/description/photos via IPFS, so activities loaded via chain sync —
 * e.g. on a fresh install/new device, with nothing in local AsyncStorage —
 * show their real metadata instead of blank fields. Best-effort: a fetch
 * failure for one CID just leaves that activity's metadata fields unset. */
async function hydrateActivityMetadata(activities: SyncedActivity[]): Promise<SyncedActivity[]> {
  const cids = Array.from(
    new Set(activities.map((a) => a.metadataCid).filter((cid): cid is string => !!cid))
  );
  if (cids.length === 0) return activities;

  const metadataByCid = new Map<string, ActivityMetadata | null>();
  await Promise.all(
    cids.map(async (cid) => {
      metadataByCid.set(cid, await fetchJsonFromIpfs<ActivityMetadata>(cid));
    })
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
    };
  });
}

async function fetchActivityRecordedLogs(
  client: ReturnType<typeof getPublicClient>,
  contracts: ReturnType<typeof getContracts>,
  owner?: `0x${string}`
): Promise<SyncedActivity[]> {
  const logs = await client.getLogs({
    address: contracts.activityRegistry.address,
    event: ACTIVITY_RECORDED_EVENT,
    args: owner ? { owner } : undefined,
    fromBlock: 0n,
    toBlock: 'latest',
  });

  return logs.map((log) => {
    const { args } = decodeEventLog({
      abi: [ACTIVITY_RECORDED_EVENT],
      data: log.data,
      topics: log.topics,
    });
    const a = args as unknown as {
      activityId: bigint;
      owner: `0x${string}`;
      activityHash: `0x${string}`;
      activityType: number;
      distance: bigint;
      duration: bigint;
      timestamp: bigint;
      territoryArea: bigint;
    };

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

/** A single participant's recorded activity history, used e.g. to compare
 * distances when settling a challenge. Prefers the deployed subgraph (indexed,
 * filtered by wallet, no fromBlock:0 rescan) when one exists for the active
 * chain mode; falls back to scanning ActivityRecorded logs directly for modes
 * with no subgraph (e.g. local Anvil) or if the subgraph request itself
 * fails. */
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
    return [];
  }
}

/** Every recorded activity across all users, for the cross-user social feed.
 * Prefers the deployed subgraph (indexed, no fromBlock:0 rescan) when one
 * exists for the active chain mode; falls back to scanning ActivityRecorded
 * logs directly for modes with no subgraph (e.g. local Anvil) or if the
 * subgraph request itself fails. */
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
    return [];
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
    return [];
  }

  const results = await client.multicall({
    allowFailure: true,
    contracts: territoryIds.map((id) => ({
      ...contracts.territoryRegistry,
      functionName: 'getTerritory',
      args: [id],
    })),
  });

  const rawTerritories = results.map((callResult, i): SyncedTerritory | null => {
    if (callResult.status === 'failure') {
      console.warn('[Sync] Failed to read territory details:', callResult.error);
      return null;
    }
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

  return rawTerritories.filter((t): t is SyncedTerritory => t !== null);
}

export async function syncProfileFromChain(wallet: `0x${string}`): Promise<SyncedProfile> {
  const client = getPublicClient();
  const contracts = getContracts();

  try {
    const profileId = (await client.readContract({
      ...contracts.profileRegistry,
      functionName: 'getProfileId',
      args: [wallet],
    })) as bigint;
    return { isRegistered: true, profileId };
  } catch (e) {
    console.warn('[Sync] Failed to sync profile:', e);
    return { isRegistered: false, profileId: null };
  }
}
