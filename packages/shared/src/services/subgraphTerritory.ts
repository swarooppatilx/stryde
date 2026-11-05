import { ACTIVITY_TYPE_BY_ID } from '../constants';
import type { ActivityType } from '../types';
import { getActiveConfig } from './client';
import { fromFixedPoint } from './fixedPoint';
import { querySubgraph } from './subgraphClient';

export interface SubgraphActivityRoute {
  wallet: string;
  activityId: bigint;
  activityType: ActivityType;
  distance: number;
  timestamp: number;
  metadataCid: string;
}

const ACTIVITY_ROUTES_QUERY = `
  query GetActivityRoutes($first: Int!) {
    activities(
      first: $first
      where: { metadataCid_not: null }
      orderBy: timestamp
      orderDirection: desc
    ) {
      activityId
      user { id }
      activityType
      distance
      timestamp
      metadataCid
    }
  }
`;

export async function getActivityRoutesFromSubgraph(
  limit = 200
): Promise<SubgraphActivityRoute[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const data = await querySubgraph<{
    activities: {
      activityId: string;
      user: { id: string };
      activityType: number;
      distance: string;
      timestamp: string;
      metadataCid: string | null;
    }[];
  }>(subgraphUrl, ACTIVITY_ROUTES_QUERY, { first: limit });

  return data.activities
    .filter((a) => a.metadataCid)
    .map((a) => ({
      wallet: a.user.id.toLowerCase() as `0x${string}`,
      activityId: BigInt(a.activityId),
      activityType: ACTIVITY_TYPE_BY_ID[a.activityType] ?? 'run',
      distance: Number(a.distance),
      timestamp: Number(a.timestamp),
      metadataCid: a.metadataCid as string,
    }));
}

export interface SubgraphTerritory {
  id: `0x${string}`;
  owner: `0x${string}`;
  areaSqm: number;
  strength: number;
  capturedAt: number;
  lastReinforced: number;
  isActive: boolean;
  /** Bounding box in degrees (the registry stores it ×1e6). */
  bounds: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  };
}

const TERRITORIES_QUERY = `
  query GetTerritories($first: Int!) {
    territories(first: $first, where: { isActive: true }) {
      id
      owner { id }
      area
      strength
      capturedAt
      lastReinforced
      isActive
      minLng
      minLat
      maxLng
      maxLat
    }
  }
`;

/** Every active territory across users (owner, bounding box, stats), so the map can draw others' footprints and resolve a tap to its owner without per-territory contract reads. Own rings come from the local store. */
export async function getTerritoriesFromSubgraph(
  limit = 1000
): Promise<SubgraphTerritory[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const data = await querySubgraph<{
    territories: {
      id: string;
      owner: { id: string };
      area: string;
      strength: string;
      capturedAt: string;
      lastReinforced: string;
      isActive: boolean;
      minLng: number;
      minLat: number;
      maxLng: number;
      maxLat: number;
    }[];
  }>(subgraphUrl, TERRITORIES_QUERY, { first: limit });

  return data.territories
    .filter((t) => t.isActive)
    .map((t) => ({
      id: t.id as `0x${string}`,
      owner: t.owner.id as `0x${string}`,
      areaSqm: Number(t.area),
      strength: Number(t.strength),
      capturedAt: Number(t.capturedAt),
      lastReinforced: Number(t.lastReinforced),
      isActive: t.isActive,
      bounds: {
        minLng: fromFixedPoint(t.minLng),
        minLat: fromFixedPoint(t.minLat),
        maxLng: fromFixedPoint(t.maxLng),
        maxLat: fromFixedPoint(t.maxLat),
      },
    }));
}
