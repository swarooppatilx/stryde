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

export async function getRegisteredUsers(): Promise<RegisteredUser[]> {
  const client = getPublicClient();
  const contracts = getContracts();

  try {
    const logs = await client.getLogs({
      address: contracts.profileRegistry.address,
      event: PROFILE_CREATED_EVENT,
      fromBlock: 0n,
      toBlock: 'latest',
    });

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
      };
    });
  } catch {
    return [];
  }
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
