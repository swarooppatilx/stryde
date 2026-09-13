import { ACTIVITY_TYPE_BY_ID } from '../constants';
import type { ActivityType } from '../types';
import { getActiveConfig } from './client';
import type { OnchainEvent } from './event';
import type { OnchainGroup } from './group';
import type { SyncedActivity } from './sync';

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

async function querySubgraph<T>(
  url: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(variables ? { query, variables } : { query }),
  });

  if (!response.ok) {
    throw new Error(`Subgraph request failed: ${response.status}`);
  }

  const body = (await response.json()) as GraphQLResponse<T>;
  if (body.errors?.length) {
    throw new Error(`Subgraph query error: ${body.errors[0]?.message}`);
  }
  if (!body.data) {
    throw new Error('Subgraph returned no data');
  }
  return body.data;
}

interface ActivityEntity {
  id: string;
  activityId: string;
  user: { id: string };
  activityHash: string;
  activityType: number;
  distance: string;
  duration: string;
  territoryArea: string;
  timestamp: string;
  metadataCid: string | null;
}

const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const PAGE_SIZE = 100;

function _buildActivitiesQuery(_wallet?: string): string {
  if (_wallet && !HEX_ADDRESS_RE.test(_wallet)) {
    throw new Error(`Invalid wallet address for subgraph query: ${_wallet}`);
  }
  const where = _wallet ? `, where: { user_: { id: "${_wallet.toLowerCase()}" } }` : '';
  return `{
  activities(first: 1000, orderBy: timestamp, orderDirection: desc${where}) {
    id
    activityId
    user { id }
    activityHash
    activityType
    distance
    duration
    territoryArea
    timestamp
    metadataCid
  }
}`;
}

const ACTIVITIES_QUERY = `
  query GetActivities($first: Int!, $skip: Int!, $orderBy: String!) {
    activities(first: $first, skip: $skip, orderBy: $orderBy, orderDirection: desc) {
      id
      activityId
      user { id }
      activityHash
      activityType
      distance
      duration
      territoryArea
      timestamp
      metadataCid
    }
  }
`;

/** Returns null (rather than throwing) when no subgraph is configured for the
 * active chain mode, so callers can fall back to the getLogs-based sync path
 * without treating "not deployed here" as an error. Pass `wallet` to filter
 * to a single participant's activities (e.g. challenge settlement). */
export async function getActivitiesFromSubgraph(
  _wallet?: `0x${string}`
): Promise<SyncedActivity[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const allActivities: ActivityEntity[] = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: ACTIVITIES_QUERY,
        variables: { first: PAGE_SIZE, skip, orderBy: 'timestamp' },
      }),
    });

    if (!response.ok) {
      throw new Error(`Subgraph request failed: ${response.status}`);
    }

    const body = (await response.json()) as GraphQLResponse<{ activities: ActivityEntity[] }>;
    if (body.errors?.length) {
      throw new Error(`Subgraph query error: ${body.errors[0]?.message}`);
    }

    const activities = body.data?.activities ?? [];
    allActivities.push(...activities);
    hasMore = activities.length === PAGE_SIZE;
    skip += PAGE_SIZE;
  }

  return allActivities.map((a) => {
    const activityType: ActivityType = ACTIVITY_TYPE_BY_ID[a.activityType] ?? 'run';
    return {
      activityHash: a.activityHash,
      owner: a.user.id,
      activityId: BigInt(a.activityId),
      activityType,
      distance: Number(a.distance),
      duration: Number(a.duration),
      territoryArea: Number(a.territoryArea),
      timestamp: Number(a.timestamp),
      metadata: '',
      metadataCid: a.metadataCid ?? undefined,
    } satisfies SyncedActivity;
  });
}

interface ProfileAvatarEntity {
  id: string;
  avatarCid: string | null;
}

interface ProfileEntity {
  id: string;
  username: string;
  isVerified: boolean;
}

const PROFILE_AVATARS_QUERY = `{
  profiles(first: 1000, where: { avatarCid_not: null }) {
    id
    avatarCid
  }
}`;

const PROFILES_QUERY = `{
  profiles(first: 1000) {
    id
    username
    isVerified
  }
}`;

/** Returns null (rather than throwing) when no subgraph is configured for the
 * active chain mode, so callers can fall back to the getLogs-based scan
 * without treating "not deployed here" as an error. */
export async function getProfileAvatarsFromSubgraph(): Promise<Map<string, string> | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const data = await querySubgraph<{ profiles: ProfileAvatarEntity[] }>(
    subgraphUrl,
    PROFILE_AVATARS_QUERY
  );

  const byWallet = new Map<string, string>();
  for (const profile of data.profiles) {
    if (profile.avatarCid) {
      byWallet.set(profile.id.toLowerCase(), profile.avatarCid);
    }
  }
  return byWallet;
}

/** Returns null (rather than throwing) when no subgraph is configured for the
 * active chain mode, so callers can fall back to the getLogs-based sync path
 * without treating "not deployed here" as an error. */
export async function getProfilesFromSubgraph(): Promise<
  { wallet: string; username: string; isVerified: boolean }[] | null
> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const data = await querySubgraph<{ profiles: ProfileEntity[] }>(subgraphUrl, PROFILES_QUERY);

  return data.profiles.map((p) => ({
    wallet: p.id,
    username: p.username,
    isVerified: p.isVerified,
  }));
}

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

/** A single GraphQL document spanning ProfileRegistry, ActivityRegistry,
 * TerritoryRegistry, SeasonManager and AchievementRegistry data — one round
 * trip composing across every registry's indexed data via the `Profile`
 * entity's @derivedFrom relations, rather than one query per registry. */
const ATHLETE_COMPOSITE_QUERY = `
  query GetAthleteComposite($id: Bytes!) {
    profile(id: $id) {
      id
      username
      profileId
      avatarCid
      isVerified
      verifiedAt
      activities(first: 20, orderBy: timestamp, orderDirection: desc) {
        activityId
        activityHash
        activityType
        distance
        duration
        territoryArea
        timestamp
        metadataCid
      }
      territories(first: 50) {
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
  /** 1e6-fixed-point bounding box (0 missing on old index) — lets callers
   * draw representative territory geometry without contract read-noise. */
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

/** Composed athlete profile: one query spanning Profile + Activity + Territory
 * + Season/Contribution + Achievement data, rather than separate queries per
 * registry. Returns null when no subgraph is configured for the active chain
 * mode, or when the wallet has no indexed profile yet, so callers can fall
 * back to the on-chain per-registry sync path. */
export async function getAthleteComposite(wallet: `0x${string}`): Promise<AthleteComposite | null> {
  if (!HEX_ADDRESS_RE.test(wallet)) {
    throw new Error(`Invalid wallet address for subgraph query: ${wallet}`);
  }
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

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
        minLng: t.minLng,
        minLat: t.minLat,
        maxLng: t.maxLng,
        maxLat: t.maxLat,
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

interface SeasonParticipantEntity {
  totalContribution: string;
  user: {
    id: string;
    username: string;
    isVerified: boolean;
    territories: { area: string }[];
    achievements: { id: string }[];
  };
}

/** One query spanning SeasonManager (contribution totals) + TerritoryRegistry
 * (active territory area) + AchievementRegistry (achievement count) +
 * ProfileRegistry (username + World ID verification status), via the
 * SeasonParticipant -> Profile relation — a composed multi-metric leaderboard
 * rather than a single-registry query. */
const SEASON_LEADERBOARD_QUERY = `
  query GetSeasonLeaderboard($seasonId: String!) {
    seasonParticipants(
      first: 1000
      where: { season: $seasonId }
      orderBy: totalContribution
      orderDirection: desc
    ) {
      totalContribution
      user {
        id
        username
        isVerified
        territories(first: 1000, where: { isActive: true }) {
          area
        }
        achievements(first: 1000) {
          id
        }
      }
    }
  }
`;

export interface SubgraphLeaderboardEntry {
  wallet: string;
  username: string;
  isVerified: boolean;
  distance: number;
  territoryArea: number;
  achievementCount: number;
  /** Weighted composite rank: distance + a fraction of territory area (sqm)
   * + a fixed bonus per achievement, then a sybil-resistance multiplier for
   * World ID Selfie Check-verified athletes. Weights are tuned for a running
   * app where distances are in meters (hundreds-thousands) and territory
   * areas are typically larger (thousands-tens of thousands of sqm). */
  score: number;
}

const TERRITORY_AREA_WEIGHT = 0.05;
const ACHIEVEMENT_WEIGHT = 500;
/** World ID-verified athletes rank 10% higher at equal raw stats — a UX-level
 * sybil-resistance signal (see FEEDBACK.md), not a hard requirement. */
const VERIFIED_SCORE_MULTIPLIER = 1.1;

/** Multi-metric leaderboard (distance + territory area + achievements) for a
 * season, ranked by a weighted composite score. Returns null (rather than
 * throwing) when no subgraph is configured for the active chain mode, so
 * callers can fall back to the on-chain, distance-only leaderboard. */
export async function getLeaderboardFromSubgraph(
  seasonId: bigint
): Promise<SubgraphLeaderboardEntry[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const data = await querySubgraph<{ seasonParticipants: SeasonParticipantEntity[] }>(
    subgraphUrl,
    SEASON_LEADERBOARD_QUERY,
    { seasonId: seasonId.toString() }
  );

  const entries = data.seasonParticipants.map((sp) => {
    const distance = Number(sp.totalContribution);
    const territoryArea = sp.user.territories.reduce((sum, t) => sum + Number(t.area), 0);
    const achievementCount = sp.user.achievements.length;
    const rawScore =
      distance + territoryArea * TERRITORY_AREA_WEIGHT + achievementCount * ACHIEVEMENT_WEIGHT;
    return {
      wallet: sp.user.id,
      isVerified: sp.user.isVerified,
      username: sp.user.username,
      distance,
      territoryArea,
      achievementCount,
      score: sp.user.isVerified ? rawScore * VERIFIED_SCORE_MULTIPLIER : rawScore,
    } satisfies SubgraphLeaderboardEntry;
  });

  return entries.sort((a, b) => b.score - a.score);
}

/** Every recorded activity across all users, plus the wallet each belongs to,
 * for the cross-user map route layer. Returns null (rather than throwing) when
 * no subgraph is configured for the active chain mode. Routes need heights, so
 * only records whose metadata (which embeds the polyline `coordinates`) has
 * been pinned to IPFS are returned — the count is bounded to the most recent
 * records to keep the IPFS metadata fetches on the client cheap. */
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
  /** 1e6-fixed-point bounding box. */
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

/** Every active territory across all users (owner + bounding box + stats), so
 * the map can render others' territory footprints and resolve a tapped
 * territory to its owner without a per-territory contract read. Own territory
 * rings come from the local store; only "others" data is subgraph-gated. */
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
        minLng: t.minLng,
        minLat: t.minLat,
        maxLng: t.maxLng,
        maxLat: t.maxLat,
      },
    }));
}

interface GroupEntity {
  id: string;
  owner: { id: string } | null;
  name: string;
  location: string;
  description: string;
  sportType: number;
  memberCount: string;
  createdAt: string;
  active: boolean;
}

const GROUPS_QUERY = `
  query GetGroups($first: Int!, $skip: Int!) {
    groups(first: $first, skip: $skip, where: { active: true }, orderBy: createdAt, orderDirection: desc) {
      id
      owner { id }
      name
      location
      description
      sportType
      memberCount
      createdAt
      active
    }
  }
`;

function mapGroupEntity(g: GroupEntity): OnchainGroup {
  return {
    id: BigInt(g.id),
    owner: (g.owner?.id ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
    name: g.name,
    location: g.location,
    description: g.description,
    sportType: g.sportType,
    memberCount: Number(g.memberCount),
    createdAt: Number(g.createdAt),
    active: g.active,
  };
}

/** Every active group, for the community/groups tab. Returns null (rather
 * than throwing) when no subgraph is configured for the active chain mode, so
 * callers can fall back to the on-chain getGroupCount()+getGroup() scan
 * without treating "not deployed here" as an error. */
export async function getGroupsFromSubgraph(): Promise<OnchainGroup[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const allGroups: GroupEntity[] = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: GROUPS_QUERY,
        variables: { first: PAGE_SIZE, skip },
      }),
    });

    if (!response.ok) {
      throw new Error(`Subgraph request failed: ${response.status}`);
    }

    const body = (await response.json()) as GraphQLResponse<{ groups: GroupEntity[] }>;
    if (body.errors?.length) {
      throw new Error(`Subgraph query error: ${body.errors[0]?.message}`);
    }

    const groups = body.data?.groups ?? [];
    allGroups.push(...groups);
    hasMore = groups.length === PAGE_SIZE;
    skip += PAGE_SIZE;
  }

  return allGroups.map(mapGroupEntity);
}

const USER_GROUPS_QUERY = `
  query GetUserGroups($wallet: String!) {
    groupMembers(first: 1000, where: { user_: { id: $wallet }, active: true }) {
      group {
        id
        owner { id }
        name
        location
        description
        sportType
        memberCount
        createdAt
        active
      }
    }
  }
`;

/** The groups a single wallet currently belongs to (owner or member). Returns
 * null (rather than throwing) when no subgraph is configured for the active
 * chain mode, so callers can fall back to the on-chain
 * getUserGroupIds()+getGroup() scan without treating "not deployed here" as
 * an error. */
export async function getUserGroupsFromSubgraph(
  wallet: `0x${string}`
): Promise<OnchainGroup[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const response = await fetch(subgraphUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: USER_GROUPS_QUERY,
      variables: { wallet: wallet.toLowerCase() },
    }),
  });

  if (!response.ok) {
    throw new Error(`Subgraph request failed: ${response.status}`);
  }

  const body = (await response.json()) as GraphQLResponse<{
    groupMembers: { group: GroupEntity }[];
  }>;
  if (body.errors?.length) {
    throw new Error(`Subgraph query error: ${body.errors[0]?.message}`);
  }

  const groupMembers = body.data?.groupMembers ?? [];
  return groupMembers.filter((m) => m.group.active).map((m) => mapGroupEntity(m.group));
}

interface KudosEntity {
  id: string;
  activity: { id: string; activityId: string };
  giver: { id: string };
  givenAt: string;
  active: boolean;
}

const KUDOS_QUERY = `
  query GetKudos($first: Int!, $skip: Int!) {
    activityKudos_collection(
      first: $first,
      skip: $skip,
      where: { active: true },
      orderBy: givenAt,
      orderDirection: desc
    ) {
      id
      activity { id activityId }
      giver { id }
      givenAt
      active
    }
  }
`;

interface CommentEntity {
  id: string;
  activity: { id: string; activityId: string };
  author: { id: string };
  cid: string;
  createdAt: string;
}

const COMMENTS_QUERY = `
  query GetComments($first: Int!, $skip: Int!) {
    activityComments(
      first: $first,
      skip: $skip,
      orderBy: createdAt,
      orderDirection: desc
    ) {
      id
      activity { id activityId }
      author { id }
      cid
      createdAt
    }
  }
`;

export interface SubgraphKudos {
  activityId: bigint;
  giver: string;
  timestamp: number;
  active: boolean;
}

export interface SubgraphComment {
  id: string;
  activityId: bigint;
  author: string;
  cid: string;
  createdAt: number;
}

/** Returns null when no subgraph is configured, so callers can fall back
 * to the getLogs scan path. */
export async function getKudosFromSubgraph(): Promise<SubgraphKudos[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const allKudos: KudosEntity[] = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: KUDOS_QUERY,
        variables: { first: PAGE_SIZE, skip },
      }),
    });

    if (!response.ok) {
      throw new Error(`Subgraph request failed: ${response.status}`);
    }

    const body = (await response.json()) as GraphQLResponse<{
      activityKudos_collection: KudosEntity[];
    }>;
    if (body.errors?.length) {
      throw new Error(`Subgraph query error: ${body.errors[0]?.message}`);
    }

    const kudos = body.data?.activityKudos_collection ?? [];
    allKudos.push(...kudos);
    hasMore = kudos.length === PAGE_SIZE;
    skip += PAGE_SIZE;
  }

  return allKudos.map((k) => ({
    activityId: BigInt(k.activity.activityId),
    giver: k.giver.id.toLowerCase(),
    timestamp: Number(k.givenAt),
    active: k.active,
  }));
}

/** Returns null when no subgraph is configured, so callers can fall back
 * to the getLogs scan path. */
export async function getCommentsFromSubgraph(): Promise<SubgraphComment[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const allComments: CommentEntity[] = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: COMMENTS_QUERY,
        variables: { first: PAGE_SIZE, skip },
      }),
    });

    if (!response.ok) {
      throw new Error(`Subgraph request failed: ${response.status}`);
    }

    const body = (await response.json()) as GraphQLResponse<{ activityComments: CommentEntity[] }>;
    if (body.errors?.length) {
      throw new Error(`Subgraph query error: ${body.errors[0]?.message}`);
    }

    const comments = body.data?.activityComments ?? [];
    allComments.push(...comments);
    hasMore = comments.length === PAGE_SIZE;
    skip += PAGE_SIZE;
  }

  return allComments.map((c) => ({
    id: c.id,
    activityId: BigInt(c.activity.activityId),
    author: c.author.id.toLowerCase(),
    cid: c.cid,
    createdAt: Number(c.createdAt),
  }));
}

interface EventEntity {
  id: string;
  host: { id: string } | null;
  title: string;
  description: string;
  sportType: number;
  startTime: string;
  endTime: string;
  distanceGoal: string;
  startLat: number;
  startLng: number;
  participantCount: string;
  createdAt: string;
  active: boolean;
}

function mapEventEntity(e: EventEntity): OnchainEvent {
  return {
    id: BigInt(e.id),
    host: (e.host?.id ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
    title: e.title,
    description: e.description,
    sportType: e.sportType,
    startTime: Number(e.startTime),
    endTime: Number(e.endTime),
    distanceGoal: Number(e.distanceGoal),
    startLat: e.startLat,
    startLng: e.startLng,
    participantCount: Number(e.participantCount),
    createdAt: Number(e.createdAt),
    active: e.active,
  };
}

const EVENTS_QUERY = `
  query GetEvents($first: Int!, $skip: Int!) {
    events(first: $first, skip: $skip, where: { active: true }, orderBy: createdAt, orderDirection: desc) {
      id
      host { id }
      title
      description
      sportType
      startTime
      endTime
      distanceGoal
      startLat
      startLng
      participantCount
      createdAt
      active
    }
  }
`;

/** Every active event, for the community/groups tab. Returns null (rather
 * than throwing) when no subgraph is configured for the active chain mode or
 * when events aren't indexed yet (EventRegistry not deployed), so callers can
 * fall back to the on-chain getEventCount()+getEvent() scan. */
export async function getEventsFromSubgraph(): Promise<OnchainEvent[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const allEvents: EventEntity[] = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: EVENTS_QUERY,
        variables: { first: PAGE_SIZE, skip },
      }),
    });

    if (!response.ok) {
      throw new Error(`Subgraph request failed: ${response.status}`);
    }

    const body = (await response.json()) as GraphQLResponse<{ events: EventEntity[] }>;
    if (body.errors?.length) {
      throw new Error(`Subgraph query error: ${body.errors[0]?.message}`);
    }

    const events = body.data?.events ?? [];
    allEvents.push(...events);
    hasMore = events.length === PAGE_SIZE;
    skip += PAGE_SIZE;
  }

  return allEvents.map(mapEventEntity);
}

const USER_EVENTS_QUERY = `
  query GetUserEvents($wallet: String!) {
    eventParticipants(first: 1000, where: { user_: { id: $wallet }, active: true }) {
      event {
        id
        host { id }
        title
        description
        sportType
        startTime
        endTime
        distanceGoal
        startLat
        startLng
        participantCount
        createdAt
        active
      }
    }
  }
`;

/** The events a single wallet currently participates in. Returns null (rather
 * than throwing) when no subgraph is configured or events aren't indexed. */
export async function getUserEventsFromSubgraph(
  wallet: `0x${string}`
): Promise<OnchainEvent[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const response = await fetch(subgraphUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: USER_EVENTS_QUERY,
      variables: { wallet: wallet.toLowerCase() },
    }),
  });

  if (!response.ok) {
    throw new Error(`Subgraph request failed: ${response.status}`);
  }

  const body = (await response.json()) as GraphQLResponse<{
    eventParticipants: { event: EventEntity }[];
  }>;
  if (body.errors?.length) {
    throw new Error(`Subgraph query error: ${body.errors[0]?.message}`);
  }

  const eventParticipants = body.data?.eventParticipants ?? [];
  return eventParticipants.filter((ep) => ep.event.active).map((ep) => mapEventEntity(ep.event));
}
