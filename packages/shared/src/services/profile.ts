import { parseEventLogs } from 'viem';
import { getContracts, getPublicClient, type getWalletClient } from './client';
import { scanLogWindows } from './logScan';
import { getProfileAvatarsFromSubgraph, getProfilesFromSubgraph } from './subgraph';
import { writeAndConfirm } from './tx';

export async function isRegistered(wallet: `0x${string}`): Promise<boolean> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.profileRegistry,
    functionName: 'isRegistered',
    args: [wallet],
  });
}

export async function getProfileId(wallet: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.profileRegistry,
    functionName: 'getProfileId',
    args: [wallet],
  });
}

export async function getWallet(profileId: bigint): Promise<`0x${string}`> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.profileRegistry,
    functionName: 'getWallet',
    args: [profileId],
  });
}

export async function totalProfiles(): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.profileRegistry,
    functionName: 'totalProfiles',
  });
}

export interface RegisteredUser {
  wallet: string;
  username: string;
  avatarCid?: string;
  isVerified?: boolean;
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

/** Last-resort avatar lookup from the latest AvatarUpdated log (last write wins). The unbounded getLogs scan is rejected by public RPCs past a small block range, so reach it only when no subgraph is configured. */
async function getLatestAvatarByWalletFromLogs(): Promise<Map<string, string>> {
  const client = getPublicClient();
  const contracts = getContracts();

  const byWallet = new Map<string, string>();
  try {
    const logs = await scanLogWindows((fromBlock, toBlock) =>
      client.getLogs({
        address: contracts.profileRegistry.address,
        event: AVATAR_UPDATED_EVENT,
        fromBlock,
        toBlock,
        strict: true,
      })
    );

    for (const { args } of logs) byWallet.set(args.wallet.toLowerCase(), args.cid);
  } catch (error) {
    console.warn('[profile] getLatestAvatarByWallet: failed to fetch AvatarUpdated logs', error);
  }
  return byWallet;
}

/** Subgraph first, falling back to the unbounded getLogs scan when none is configured or the query fails. */
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
        isVerified: p.isVerified,
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
      scanLogWindows((fromBlock, toBlock) =>
        client.getLogs({
          address: contracts.profileRegistry.address,
          event: PROFILE_CREATED_EVENT,
          fromBlock,
          toBlock,
          strict: true,
        })
      ),
      getLatestAvatarByWallet(),
    ]);

    const users = logs.map(({ args }) => ({
      wallet: args.wallet,
      username: args.username,
      avatarCid: avatarsByWallet.get(args.wallet.toLowerCase()),
    }));

    const verifiedResults = await Promise.allSettled(
      users.map((u) =>
        client.readContract({
          ...contracts.profileRegistry,
          functionName: 'isVerified',
          args: [u.wallet as `0x${string}`],
        })
      )
    );

    return users.map((u, i) => {
      const result = verifiedResults[i];
      return { ...u, isVerified: result?.status === 'fulfilled' && result.value === true };
    });
  } catch (error) {
    console.warn('[profile] getRegisteredUsers: getLogs fallback failed', error);
    throw error;
  }
}

export async function setAvatar(
  wallet: ReturnType<typeof getWalletClient>,
  cid: string
): Promise<{ txHash: `0x${string}`; confirmed: boolean }> {
  const { txHash, confirmed } = await writeAndConfirm(wallet, 'profileRegistry', {
    functionName: 'setAvatar',
    args: [cid],
  });
  return { txHash, confirmed };
}

/** Changes the wallet's username on ProfileRegistry (reverts if it is taken or the wallet has no profile). */
export async function setUsername(
  wallet: ReturnType<typeof getWalletClient>,
  newUsername: string
): Promise<{ txHash: `0x${string}`; confirmed: boolean }> {
  const { txHash, confirmed } = await writeAndConfirm(wallet, 'profileRegistry', {
    functionName: 'setUsername',
    args: [newUsername],
  });
  return { txHash, confirmed };
}

export async function register(
  wallet: ReturnType<typeof getWalletClient>,
  username: string
): Promise<{ profileId: bigint; txHash: `0x${string}`; confirmed: boolean }> {
  const { txHash, confirmed, receipt } = await writeAndConfirm(wallet, 'profileRegistry', {
    functionName: 'register',
    args: [username],
  });
  if (!confirmed) return { profileId: 0n, txHash, confirmed };

  const [event] = parseEventLogs({
    abi: getContracts().profileRegistry.abi,
    eventName: 'ProfileCreated',
    logs: receipt.logs,
  });
  return { profileId: event?.args.profileId ?? 0n, txHash, confirmed };
}
