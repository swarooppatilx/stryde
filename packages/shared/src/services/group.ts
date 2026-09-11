import { parseEventLogs } from 'viem';
import { getActiveConfig, getContracts, getPublicClient, type getWalletClient } from './client';
import { getGroupsFromSubgraph, getUserGroupsFromSubgraph } from './subgraph';

/** Sentinel sportType value for a group that spans multiple activity types
 * (mirrors the mobile app's `'multi'` Club.sportType) — kept out of the
 * ACTIVITY_TYPE_MAP range (0-11) so it never collides with a real type. */
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
  }) as Promise<bigint>;
}

export async function getMemberCount(groupId: bigint): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.groupRegistry,
    functionName: 'getMemberCount',
    args: [groupId],
  }) as Promise<bigint>;
}

export async function isGroupMember(groupId: bigint, user: `0x${string}`): Promise<boolean> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.groupRegistry,
    functionName: 'isMember',
    args: [groupId, user],
  }) as Promise<boolean>;
}

export async function getUserGroupIds(
  user: `0x${string}`,
  offset = 0n,
  limit = 100n
): Promise<bigint[]> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.groupRegistry,
    functionName: 'getUserGroupIds',
    args: [user, offset, limit],
  }) as Promise<bigint[]>;
}

/** Every active group, on-chain scan fallback for chain modes with no
 * subgraph deployed (or if the subgraph request fails). Prefer
 * `getAllGroups()` below, which tries the subgraph first. */
async function scanAllGroupsFromChain(): Promise<OnchainGroup[]> {
  const count = await getGroupCount();
  if (count === 0n) return [];

  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
  const groups = await Promise.all(ids.map((id) => getGroup(id)));
  return groups.filter((g) => g.active);
}

/** All active groups, for the community/groups tab. Prefers the deployed
 * subgraph (indexed, no O(n) contract-read fan-out) when one exists for the
 * active chain mode; falls back to scanning getGroupCount()/getGroup()
 * directly for modes with no subgraph (e.g. local Anvil) or if the subgraph
 * request itself fails. */
export async function getAllGroups(): Promise<OnchainGroup[]> {
  try {
    const fromSubgraph = await getGroupsFromSubgraph();
    if (fromSubgraph) return fromSubgraph;
  } catch (e) {
    console.warn('[Group] Subgraph fetch failed, falling back to on-chain scan:', e);
  }

  try {
    return await scanAllGroupsFromChain();
  } catch (e) {
    console.warn('[Group] Failed to scan groups from chain:', e);
    return [];
  }
}

/** The groups a single wallet currently belongs to (owner or member).
 * Prefers the deployed subgraph when one exists for the active chain mode;
 * falls back to getUserGroupIds()+getGroup() directly otherwise. */
export async function getUserGroups(user: `0x${string}`): Promise<OnchainGroup[]> {
  try {
    const fromSubgraph = await getUserGroupsFromSubgraph(user);
    if (fromSubgraph) return fromSubgraph;
  } catch (e) {
    console.warn('[Group] Subgraph fetch failed, falling back to on-chain scan:', e);
  }

  try {
    const ids = await getUserGroupIds(user);
    const groups = await Promise.all(ids.map((id) => getGroup(id)));
    return groups.filter((g) => g.active);
  } catch (e) {
    console.warn('[Group] Failed to fetch user groups from chain:', e);
    return [];
  }
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
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.groupRegistry,
    functionName: 'createGroup',
    args: [params.name, params.location, params.description, params.sportType],
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
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

  const groupId =
    ((event as { args?: Record<string, unknown> })?.args as { groupId?: bigint } | undefined)
      ?.groupId ?? 0n;
  return { groupId, confirmed: true };
}

export async function joinGroup(
  wallet: ReturnType<typeof getWalletClient>,
  groupId: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.groupRegistry,
    functionName: 'joinGroup',
    args: [groupId],
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  return { confirmed: receipt.status === 'success', txHash: hash };
}

export async function leaveGroup(
  wallet: ReturnType<typeof getWalletClient>,
  groupId: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.groupRegistry,
    functionName: 'leaveGroup',
    args: [groupId],
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  return { confirmed: receipt.status === 'success', txHash: hash };
}

/** A group's shared on-chain treasury balance, in wei. The natural fit for
 * the Privy "business/organization managing digital assets" track — this is
 * an organization (the group/club), not an individual, holding and spending
 * pooled funds. */
export async function getGroupTreasury(groupId: bigint): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.groupRegistry,
    functionName: 'getGroupTreasury',
    args: [groupId],
  }) as Promise<bigint>;
}

/** Contribute to a group's shared treasury. Any wallet may contribute
 * (members or outside sponsors) — routes through whatever wallet client the
 * caller passes in, so it rides the same gasless Privy smart-account path as
 * every other write in the app when one is configured (see useViemWallet). */
export async function depositToTreasury(
  wallet: ReturnType<typeof getWalletClient>,
  groupId: bigint,
  amountWei: bigint
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.groupRegistry,
    functionName: 'depositToTreasury',
    args: [groupId],
    value: amountWei,
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  return { confirmed: receipt.status === 'success', txHash: hash };
}

/** Spend from a group's shared treasury — owner-gated on-chain (single
 * signer, not a real multisig/threshold approval; see FEEDBACK.md for the
 * stated production follow-up). */
export async function withdrawFromTreasury(
  wallet: ReturnType<typeof getWalletClient>,
  groupId: bigint,
  amountWei: bigint,
  to: `0x${string}`
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.groupRegistry,
    functionName: 'withdrawFromTreasury',
    args: [groupId, amountWei, to],
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  return { confirmed: receipt.status === 'success', txHash: hash };
}

export async function transferGroupOwnership(
  wallet: ReturnType<typeof getWalletClient>,
  groupId: bigint,
  newOwner: `0x${string}`
): Promise<{ confirmed: boolean; txHash?: `0x${string}` }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.groupRegistry,
    functionName: 'transferGroupOwnership',
    args: [groupId, newOwner],
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  return { confirmed: receipt.status === 'success', txHash: hash };
}
