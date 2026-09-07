import { decodeEventLog, parseEventLogs } from 'viem';
import { getActiveConfig, getContracts, getPublicClient, type getWalletClient } from './client';

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

/** There's no backend/subgraph, so a wallet's current avatar is derived from
 * the latest AvatarUpdated log it emitted — last write wins. */
async function getLatestAvatarByWallet(): Promise<Map<string, string>> {
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
  } catch {
    // ignore — callers just won't get avatars this round
  }
  return byWallet;
}

export async function getRegisteredUsers(): Promise<RegisteredUser[]> {
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
  } catch {
    return [];
  }
}

export async function setAvatar(
  wallet: ReturnType<typeof getWalletClient>,
  cid: string
): Promise<{ txHash: `0x${string}`; confirmed: boolean }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const addresses = await wallet.getAddresses();
  const account = addresses[0];
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
  const addresses = await wallet.getAddresses();
  const account = addresses[0];
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
    profileId: (event?.args as { profileId?: bigint } | undefined)?.profileId ?? 0n,
    txHash: hash,
    confirmed: true,
  };
}
