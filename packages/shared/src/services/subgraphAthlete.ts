import { ACTIVITY_TYPE_BY_ID } from '../constants';
import { getActiveConfig } from './client';
import { fromFixedPoint } from './fixedPoint';
import { indexCall } from './indexApi';
import { HEX_ADDRESS_RE, querySubgraph } from './subgraphClient';
import type { SyncedActivity } from './sync';

interface AthleteCompositeEntity {
  id: string;
  username: string;
  profileId: string;
  avatarCid: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  activities: {
    activityId: string;
    activityHash: string;
    activityType: number;
    distance: string;
    duration: string;
    territoryArea: string;
    timestamp: string;
    metadataCid: string | null;
  }[];
  territories: {
    id: string;
    area: string;
    strength: string;
    isActive: boolean;
    capturedAt: string;
    lastReinforced: string;
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  }[];
  contributions: {
    distance: string;
    season: { id: string; isActive: boolean; totalContributions: string };
  }[];
  achievements: {
    id: string;
    achievementId: string;
    mintedAt: string;
    definition: { name: string } | null;
  }[];
}

/** One GraphQL document across Profile, Activity, Territory, Season and Achievement data via the `Profile` entity's @derivedFrom relations, instead of one query per registry. */
const ATHLETE_COMPOSITE_QUERY = `
  query GetAthleteComposite($id: Bytes!) {
    profile(id: $id) {
      id
      username
      profileId
      avatarCid
      isVerified
      verifiedAt
      activities(first: 1000, orderBy: timestamp, orderDirection: desc) {
        activityId
        activityHash
        activityType
        distance
        duration
        territoryArea
        timestamp
        metadataCid
      }
      territories(first: 1000) {
        id
        area
        strength
        isActive
        capturedAt
        lastReinforced
        minLng
        minLat
        maxLng
        maxLat
      }
      contributions(first: 10) {
        distance
        season {
          id
          isActive
          totalContributions
        }
      }
      achievements(first: 20) {
        id
        achievementId
        mintedAt
        definition {
          name
        }
      }
    }
  }
`;

export interface AthleteCompositeTerritory {
  id: string;
  areaSqm: number;
  strength: number;
  isActive: boolean;
  capturedAt: number;
  lastReinforced: number;
  /** Bounding box in degrees; 0 when missing on an old index. */
  bounds?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
}

export interface AthleteComposite {
  wallet: string;
  username: string;
  profileId: bigint;
  avatarCid?: string;
  isVerified: boolean;
  verifiedAt?: number;
  activities: SyncedActivity[];
  territories: AthleteCompositeTerritory[];
  contributions: {
    distance: number;
    seasonId: string;
    seasonActive: boolean;
    seasonTotalContributions: number;
  }[];
  achievements: {
    id: string;
    achievementId: string;
    mintedAt: number;
    name?: string;
  }[];
}

/** Composed athlete profile in one query. Null when no subgraph is configured or the wallet has no indexed profile, so callers fall back to the per-registry sync path. */
export async function getAthleteComposite(wallet: `0x${string}`): Promise<AthleteComposite | null> {
  if (!HEX_ADDRESS_RE.test(wallet)) {
    throw new Error(`Invalid wallet address for subgraph query: ${wallet}`);
  }
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return athleteFromIndex(wallet);

  const data = await querySubgraph<{ profile: AthleteCompositeEntity | null }>(
    subgraphUrl,
    ATHLETE_COMPOSITE_QUERY,
    { id: wallet.toLowerCase() }
  );

  const p = data.profile;
  if (!p) return null;

  return {
    wallet: p.id,
    username: p.username,
    profileId: BigInt(p.profileId),
    avatarCid: p.avatarCid ?? undefined,
    isVerified: p.isVerified,
    verifiedAt: p.verifiedAt ? Number(p.verifiedAt) : undefined,
    activities: p.activities.map(
      (a) =>
        ({
          activityHash: a.activityHash,
          owner: p.id,
          activityId: BigInt(a.activityId),
          activityType: ACTIVITY_TYPE_BY_ID[a.activityType] ?? 'run',
          distance: Number(a.distance),
          duration: Number(a.duration),
          territoryArea: Number(a.territoryArea),
          timestamp: Number(a.timestamp),
          metadata: '',
          metadataCid: a.metadataCid ?? undefined,
        }) satisfies SyncedActivity
    ),
    territories: p.territories.map((t) => ({
      id: t.id,
      areaSqm: Number(t.area),
      strength: Number(t.strength),
      isActive: t.isActive,
      capturedAt: Number(t.capturedAt),
      lastReinforced: Number(t.lastReinforced),
      bounds: {
        minLng: fromFixedPoint(t.minLng),
        minLat: fromFixedPoint(t.minLat),
        maxLng: fromFixedPoint(t.maxLng),
        maxLat: fromFixedPoint(t.maxLat),
      },
    })),
    contributions: p.contributions.map((c) => ({
      distance: Number(c.distance),
      seasonId: c.season.id,
      seasonActive: c.season.isActive,
      seasonTotalContributions: Number(c.season.totalContributions),
    })),
    achievements: p.achievements.map((a) => ({
      id: a.id,
      achievementId: a.achievementId,
      mintedAt: Number(a.mintedAt),
      name: a.definition?.name,
    })),
  };
}

interface IndexedAthlete {
  wallet: string;
  profileId: string;
  username: string;
  isVerified: boolean;
  avatarCid: string | null;
  activities: {
    activityId: string;
    activityHash: string;
    activityType: number;
    distance: number;
    duration: number;
    timestamp: number;
    territoryArea: number;
    metadataCid: string | null;
  }[];
  territories: AthleteCompositeTerritory[];
  achievements: { achievementId: string; mintedAt: number }[];
  contributions: { seasonId: string; distance: number }[];
}

/** The same composite from the Arkiv index, for chains with no subgraph. Null when the index has no profile for the wallet. */
async function athleteFromIndex(wallet: `0x${string}`): Promise<AthleteComposite | null> {
  const answer = await indexCall<{ athlete: IndexedAthlete }>(`athlete/${wallet.toLowerCase()}`);
  const p = answer?.athlete;
  if (!p) return null;
  return {
    wallet: p.wallet,
    username: p.username,
    profileId: BigInt(p.profileId),
    avatarCid: p.avatarCid ?? undefined,
    isVerified: p.isVerified,
    activities: p.activities.map(
      (a) =>
        ({
          activityHash: a.activityHash,
          owner: p.wallet,
          activityId: BigInt(a.activityId),
          activityType: ACTIVITY_TYPE_BY_ID[a.activityType] ?? 'run',
          distance: a.distance,
          duration: a.duration,
          territoryArea: a.territoryArea,
          timestamp: a.timestamp,
          metadata: '',
          metadataCid: a.metadataCid ?? undefined,
        }) satisfies SyncedActivity
    ),
    territories: p.territories,
    // The index does not track whether a season is still running, nor its total: no screen reads them from here.
    contributions: p.contributions.map((c) => ({
      distance: c.distance,
      seasonId: c.seasonId,
      seasonActive: false,
      seasonTotalContributions: 0,
    })),
    achievements: p.achievements.map((a) => ({
      id: a.achievementId,
      achievementId: a.achievementId,
      mintedAt: a.mintedAt,
    })),
  };
}
