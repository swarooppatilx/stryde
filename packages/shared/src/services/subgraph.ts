import { ACTIVITY_TYPE_BY_ID } from '../constants';
import type { ActivityType } from '../types';
import { getActiveConfig } from './client';
import type { OnchainGroup } from './group';
import type { SyncedActivity } from './sync';

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

async function querySubgraph<T>(url: string, query: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
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
  { wallet: string; username: string }[] | null
> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const data = await querySubgraph<{ profiles: ProfileEntity[] }>(subgraphUrl, PROFILES_QUERY);

  return data.profiles.map((p) => ({
    wallet: p.id,
    username: p.username,
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
