import { decodeEventLog } from 'viem';
import { ACTIVITY_TYPE_BY_ID } from '../constants';
import type { ActivityType } from '../types';
import { getContracts, getPublicClient } from './client';
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
      return fromSubgraph.sort((a, b) => (b.activityId > a.activityId ? 1 : -1));
    }
  } catch {
    // fall through to the on-chain scan below
  }

  const client = getPublicClient();
  const contracts = getContracts();

  try {
    const activities = await fetchActivityRecordedLogs(client, contracts, wallet);
    return activities.sort((a, b) => (b.activityId > a.activityId ? 1 : -1));
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
      return fromSubgraph.sort((a, b) => (b.activityId > a.activityId ? 1 : -1));
    }
  } catch {
    // fall through to the on-chain scan below
  }

  const client = getPublicClient();
  const contracts = getContracts();

  try {
    const activities = await fetchActivityRecordedLogs(client, contracts);
    return activities.sort((a, b) => (b.activityId > a.activityId ? 1 : -1));
  } catch {
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
  } catch {
    return [];
  }

  const rawTerritories = await Promise.all(
    territoryIds.map(async (id) => {
      try {
        const t = (await client.readContract({
          ...contracts.territoryRegistry,
          functionName: 'getTerritory',
          args: [id],
        })) as {
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
          id: id as string,
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
      } catch {
        return null;
      }
    })
  );

  return rawTerritories.filter((t): t is SyncedTerritory => t !== null);
}

export async function syncProfileFromChain(wallet: `0x${string}`): Promise<SyncedProfile> {
  const client = getPublicClient();
  const contracts = getContracts();

  let registered: boolean;
  try {
    registered = (await client.readContract({
      ...contracts.profileRegistry,
      functionName: 'isRegistered',
      args: [wallet],
    })) as boolean;
  } catch {
    return { isRegistered: false, profileId: null };
  }

  if (!registered) {
    return { isRegistered: false, profileId: null };
  }

  try {
    const profileId = (await client.readContract({
      ...contracts.profileRegistry,
      functionName: 'getProfileId',
      args: [wallet],
    })) as bigint;

    return { isRegistered: true, profileId };
  } catch {
    return { isRegistered: true, profileId: null };
  }
}
