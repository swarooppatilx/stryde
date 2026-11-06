import { parseEventLogs } from 'viem';
import { getContracts, getPublicClient, type getWalletClient } from './client';
import { getGroupsFromSubgraph, getUserGroupsFromSubgraph } from './subgraph';
import { writeAndConfirm } from './tx';

/** Sentinel `sportType` for multi-sport groups (mirrors the app's `'multi'`); outside ACTIVITY_TYPE_MAP (0-11) so it never collides. */
export const MULTI_SPORT_TYPE = 255;

export interface OnchainGroup {
  id: bigint;
  owner: `0x${string}`;
  name: string;
  location: string;
  description: string;
  sportType: number;
  memberCount: number;
  createdAt: number;
  active: boolean;
}

interface RawGroup {
  owner: `0x${string}`;
  name: string;
  location: string;
  description: string;
  sportType: number;
  memberCount: bigint;
  createdAt: bigint;
  active: boolean;
}

function toOnchainGroup(groupId: bigint, raw: RawGroup): OnchainGroup {
  return {
    id: groupId,
    owner: raw.owner,
    name: raw.name,
    location: raw.location,
    description: raw.description,
    sportType: raw.sportType,
    memberCount: Number(raw.memberCount),
    createdAt: Number(raw.createdAt),
    active: raw.active,
  };
}

export async function getGroup(groupId: bigint): Promise<OnchainGroup> {
  const client = getPublicClient();
  const contracts = getContracts();
  const raw = (await client.readContract({
    ...contracts.groupRegistry,
    functionName: 'getGroup',
    args: [groupId],
  })) as RawGroup;

  return toOnchainGroup(groupId, raw);
}

export async function getGroupCount(): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.groupRegistry,
    functionName: 'getGroupCount',
  });
}

export async function getMemberCount(groupId: bigint): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.groupRegistry,
    functionName: 'getMemberCount',
    args: [groupId],
  });
}

export async function getUserGroupIds(
  user: `0x${string}`,
  offset = 0n,
  limit = 100n
): Promise<readonly bigint[]> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.groupRegistry,
    functionName: 'getUserGroupIds',
    args: [user, offset, limit],
  });
}

/** Every active group via on-chain scan; fallback for modes with no subgraph or when its request fails. Prefer `getAllGroups()`. */
async function scanAllGroupsFromChain(): Promise<OnchainGroup[]> {
  const count = await getGroupCount();
  if (count === 0n) return [];

  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
  const groups = await Promise.all(ids.map((id) => getGroup(id)));
  return groups.filter((g) => g.active);
}

/** All active groups; subgraph first (no O(n) read fan-out), else scans getGroupCount()/getGroup(). */
export async function getAllGroups(): Promise<OnchainGroup[]> {
  try {
    const fromSubgraph = await getGroupsFromSubgraph();
    if (fromSubgraph) return fromSubgraph;
  } catch (e) {
    console.warn('[Group] Subgraph fetch failed, falling back to on-chain scan:', e);
  }

  // No catch: an empty list means "there are none", not "couldn't read".
  return scanAllGroupsFromChain();
}

/** The groups a wallet belongs to (owner or member); subgraph first, else getUserGroupIds()+getGroup(). */
export async function getUserGroups(user: `0x${string}`): Promise<OnchainGroup[]> {
  try {
    const fromSubgraph = await getUserGroupsFromSubgraph(user);
    if (fromSubgraph) return fromSubgraph;
  } catch (e) {
    console.warn('[Group] Subgraph fetch failed, falling back to on-chain scan:', e);
  }

  const ids = await getUserGroupIds(user);
  const groups = await Promise.all(ids.map((id) => getGroup(id)));
  return groups.filter((g) => g.active);
}

export async function createGroup(
  wallet: ReturnType<typeof getWalletClient>,
  params: {
    name: string;
    location: string;
    description: string;
    sportType: number;
  }
): Promise<{ groupId: bigint; confirmed: boolean }> {
  const contracts = getContracts();

  const { confirmed, receipt } = await writeAndConfirm(wallet, 'groupRegistry', {
    functionName: 'createGroup',
    args: [params.name, params.location, params.description, params.sportType],
  });
  if (!confirmed) {
    return { groupId: 0n, confirmed: false };
  }

  // Read the id from this tx's own GroupCreated event rather than the global
  // getGroupCount() — a concurrent createGroup would shift that counter and
  // hand back a stranger's group.
  const [event] = parseEventLogs({
    abi: contracts.groupRegistry.abi,
    eventName: 'GroupCreated',
    logs: receipt.logs,
  });

  const groupId = event?.args.groupId ?? 0n;
  return { groupId, confirmed: true };
}

export async function joinGroup(
  wallet: ReturnType<typeof getWalletClient>,
  groupId: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const { txHash, confirmed } = await writeAndConfirm(wallet, 'groupRegistry', {
    functionName: 'joinGroup',
    args: [groupId],
  });
  return { confirmed, txHash };
}

export async function leaveGroup(
  wallet: ReturnType<typeof getWalletClient>,
  groupId: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const { txHash, confirmed } = await writeAndConfirm(wallet, 'groupRegistry', {
    functionName: 'leaveGroup',
    args: [groupId],
  });
  return { confirmed, txHash };
}

/** A group's shared treasury balance, in wei. */
export async function getGroupTreasury(groupId: bigint): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.groupRegistry,
    functionName: 'getGroupTreasury',
    args: [groupId],
  });
}

/** Contributes to a group's treasury; any wallet may, via the caller-supplied wallet client so it uses the gasless smart-account path when configured. */
export async function depositToTreasury(
  wallet: ReturnType<typeof getWalletClient>,
  groupId: bigint,
  amountWei: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const { txHash, confirmed } = await writeAndConfirm(wallet, 'groupRegistry', {
    functionName: 'depositToTreasury',
    args: [groupId],
    value: amountWei,
  });
  return { confirmed, txHash };
}

/** Spends from a group's treasury; owner-gated on-chain with a single signer, not a multisig. */
export async function withdrawFromTreasury(
  wallet: ReturnType<typeof getWalletClient>,
  groupId: bigint,
  amountWei: bigint,
  to: `0x${string}`
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const { txHash, confirmed } = await writeAndConfirm(wallet, 'groupRegistry', {
    functionName: 'withdrawFromTreasury',
    args: [groupId, amountWei, to],
  });
  return { confirmed, txHash };
}

export async function transferGroupOwnership(
  wallet: ReturnType<typeof getWalletClient>,
  groupId: bigint,
  newOwner: `0x${string}`
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const { txHash, confirmed } = await writeAndConfirm(wallet, 'groupRegistry', {
    functionName: 'transferGroupOwnership',
    args: [groupId, newOwner],
  });
  return { confirmed, txHash };
}
