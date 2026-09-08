import { decodeEventLog, parseEventLogs } from 'viem';
import { getActiveConfig, getContracts, getPublicClient, type getWalletClient } from './client';
import { getProfileAvatarsFromSubgraph, getProfilesFromSubgraph } from './subgraph';

export async function isRegistered(wallet: `0x${string}`): Promise<boolean> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.profileRegistry,
    functionName: 'isRegistered',
    args: [wallet],
  }) as Promise<boolean>;
}

export async function getProfileId(wallet: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.profileRegistry,
    functionName: 'getProfileId',
    args: [wallet],
  }) as Promise<bigint>;
}

export async function getWallet(profileId: bigint): Promise<`0x${string}`> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.profileRegistry,
    functionName: 'getWallet',
    args: [profileId],
  }) as Promise<`0x${string}`>;
}

export async function totalProfiles(): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.profileRegistry,
    functionName: 'totalProfiles',
  }) as Promise<bigint>;
}

export interface RegisteredUser {
  wallet: string;
  username: string;
  avatarCid?: string;
}

const PROFILE_CREATED_EVENT = {
  type: 'event',
  name: 'ProfileCreated',
  inputs: [
    { type: 'uint256', name: 'profileId', indexed: true },
    { type: 'address', name: 'wallet', indexed: true },
    { type: 'string', name: 'username', indexed: false },
    { type: 'uint256', name: 'joinedAt', indexed: false },
  ],
} as const;

const AVATAR_UPDATED_EVENT = {
  type: 'event',
  name: 'AvatarUpdated',
  inputs: [
    { type: 'address', name: 'wallet', indexed: true },
    { type: 'string', name: 'cid', indexed: false },
  ],
} as const;

/** Last-resort fallback: derives a wallet's current avatar from the latest
 * AvatarUpdated log it emitted — last write wins. This does an unbounded
 * getLogs scan, which public RPC providers (e.g. the Sepolia publicnode
 * endpoint) reject past a small block range, so it should only be reached
 * when no subgraph is configured for the active chain mode. */
async function getLatestAvatarByWalletFromLogs(): Promise<Map<string, string>> {
  const client = getPublicClient();
  const contracts = getContracts();

  const byWallet = new Map<string, string>();
  try {
    const logs = await client.getLogs({
      address: contracts.profileRegistry.address,
      event: AVATAR_UPDATED_EVENT,
      fromBlock: 0n,
      toBlock: 'latest',
    });

    for (const log of logs) {
      const parsed = decodeEventLog({
        abi: contracts.profileRegistry.abi,
        data: log.data,
        topics: log.topics,
      });
      const args = parsed.args as unknown as { wallet: `0x${string}`; cid: string };
      byWallet.set(args.wallet.toLowerCase(), args.cid);
    }
  } catch (error) {
    console.warn('[profile] getLatestAvatarByWallet: failed to fetch AvatarUpdated logs', error);
  }
  return byWallet;
}

/** Subgraph-first, falling back to the unbounded getLogs scan only when no
 * subgraph is configured (or the subgraph query fails) for the active chain
 * mode — mirrors the resilience pattern used elsewhere in this file. */
async function getLatestAvatarByWallet(): Promise<Map<string, string>> {
  try {
    const fromSubgraph = await getProfileAvatarsFromSubgraph();
    if (fromSubgraph) return fromSubgraph;
  } catch (err) {
    console.warn('getLatestAvatarByWallet: subgraph query failed, falling back to log scan', err);
  }
  return getLatestAvatarByWalletFromLogs();
}

export async function getRegisteredUsers(): Promise<RegisteredUser[]> {
  try {
    const profiles = await getProfilesFromSubgraph();
    if (profiles) {
      const avatarsByWallet = await getLatestAvatarByWallet();
      return profiles.map((p) => ({
        wallet: p.wallet,
        username: p.username,
        avatarCid: avatarsByWallet.get(p.wallet.toLowerCase()),
      }));
    }
  } catch (error) {
    console.warn(
      '[profile] getRegisteredUsers: subgraph lookup failed, falling back to getLogs',
      error
    );
  }

  const client = getPublicClient();
  const contracts = getContracts();

  try {
    const [logs, avatarsByWallet] = await Promise.all([
      client.getLogs({
        address: contracts.profileRegistry.address,
        event: PROFILE_CREATED_EVENT,
        fromBlock: 0n,
        toBlock: 'latest',
      }),
      getLatestAvatarByWallet(),
    ]);

    return logs.map((log) => {
      const parsed = decodeEventLog({
        abi: contracts.profileRegistry.abi,
        data: log.data,
        topics: log.topics,
      });
      const args = parsed.args as unknown as {
        profileId: bigint;
        wallet: `0x${string}`;
        username: string;
        joinedAt: bigint;
      };
      return {
        wallet: args.wallet,
        username: args.username,
        avatarCid: avatarsByWallet.get(args.wallet.toLowerCase()),
      };
    });
  } catch (error) {
    console.warn('[profile] getRegisteredUsers: getLogs fallback failed', error);
    return [];
  }
}

export async function setAvatar(
  wallet: ReturnType<typeof getWalletClient>,
  cid: string
): Promise<{ txHash: `0x${string}`; confirmed: boolean }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.profileRegistry,
    functionName: 'setAvatar',
    args: [cid],
    account,
    chain: config.chain,
  });

  const client = getPublicClient();
  const receipt = await client.waitForTransactionReceipt({ hash });
  return { txHash: hash, confirmed: receipt.status === 'success' };
}

export async function register(
  wallet: ReturnType<typeof getWalletClient>,
  username: string
): Promise<{ profileId: bigint; txHash: `0x${string}`; confirmed: boolean }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.profileRegistry,
    functionName: 'register',
    args: [username],
    account,
    chain: config.chain,
  });

  const client = getPublicClient();
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    return { profileId: 0n, txHash: hash, confirmed: false };
  }

  const [event] = parseEventLogs({
    abi: contracts.profileRegistry.abi,
    eventName: 'ProfileCreated',
    logs: receipt.logs,
  });

  return {
    profileId:
      ((event as { args?: Record<string, unknown> })?.args as { profileId?: bigint } | undefined)
        ?.profileId ?? 0n,
    txHash: hash,
    confirmed: true,
  };
}
