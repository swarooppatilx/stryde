import { zeroAddress } from 'viem';
import { getActiveConfig } from './client';
import type { OnchainGroup } from './group';
import { indexCall } from './indexApi';
import { querySubgraph } from './subgraphClient';
import { paginate } from './subgraphPaginate';

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

function mapGroupEntity(g: GroupEntity): OnchainGroup {
  return {
    id: BigInt(g.id),
    owner: (g.owner?.id ?? zeroAddress) as `0x${string}`,
    name: g.name,
    location: g.location,
    description: g.description,
    sportType: g.sportType,
    memberCount: Number(g.memberCount),
    createdAt: Number(g.createdAt),
    active: g.active,
  };
}

/** Every active group; null (not an error) when no subgraph is configured, so callers fall back to the on-chain scan. */
export async function getGroupsFromSubgraph(): Promise<OnchainGroup[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const allGroups = await paginate<GroupEntity>({
    url: subgraphUrl,
    collection: 'groups',
    idType: 'String',
    selection: 'id owner { id } name location description sportType memberCount createdAt active',
    where: 'active: true',
  });
  allGroups.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

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

/** The groups a wallet belongs to (owner or member); null when no subgraph is configured. */
export async function getUserGroupsFromSubgraph(
  wallet: `0x${string}`
): Promise<OnchainGroup[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) return null;

  const data = await querySubgraph<{
    groupMembers: { group: GroupEntity }[];
  }>(subgraphUrl, USER_GROUPS_QUERY, { wallet: wallet.toLowerCase() });
  const groupMembers = data.groupMembers;
  return groupMembers.filter((m) => m.group.active).map((m) => mapGroupEntity(m.group));
}

const GROUP_MEMBERS_QUERY = `
  query GetGroupMembers($group: String!) {
    groupMembers(first: 1000, where: { group: $group, active: true }) {
      user { id }
    }
  }
`;

/** The wallets currently in a group. Null (not an error) when no subgraph is configured for the active chain mode. */
export async function getGroupMembersFromSubgraph(
  groupId: bigint
): Promise<`0x${string}`[] | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) {
    const answer = await indexCall<{ members: `0x${string}`[] }>(`group/${groupId}/members`);
    return answer?.members ?? null;
  }

  const data = await querySubgraph<{ groupMembers: { user: { id: string } }[] }>(
    subgraphUrl,
    GROUP_MEMBERS_QUERY,
    { group: groupId.toString() }
  );
  return data.groupMembers.map((m) => m.user.id as `0x${string}`);
}
