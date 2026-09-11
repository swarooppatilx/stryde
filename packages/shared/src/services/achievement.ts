import { keccak256, toBytes } from 'viem';
import {
  getActiveConfig,
  getChainMode,
  getContracts,
  getPublicClient,
  type getWalletClient,
} from './client';
import { relayMintAchievement } from './relay';

export interface OnchainAchievement {
  name: string;
  exists: boolean;
}

export function computeAchievementId(id: string): `0x${string}` {
  return keccak256(toBytes(id));
}

export async function getAchievement(id: string): Promise<OnchainAchievement> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.achievementRegistry,
    functionName: 'getAchievement',
    args: [computeAchievementId(id)],
  }) as Promise<OnchainAchievement>;
}

export async function getTokenIds(user: `0x${string}`): Promise<bigint[]> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.achievementRegistry,
    functionName: 'getTokenIds',
    args: [user],
  }) as Promise<bigint[]>;
}

export async function getTokenAchievement(tokenId: bigint): Promise<`0x${string}`> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.achievementRegistry,
    functionName: 'getTokenAchievement',
    args: [tokenId],
  }) as Promise<`0x${string}`>;
}

/** Which of the given local achievement ids already have a minted, soulbound token for this user. */
export async function getMintedAchievementIds(
  user: `0x${string}`,
  achievementIds: string[]
): Promise<Set<string>> {
  const tokenIds = await getTokenIds(user);
  if (tokenIds.length === 0) return new Set();

  const client = getPublicClient();
  const contracts = getContracts();
  const hashes: `0x${string}`[] = [];
  for (let i = 0; i < tokenIds.length; i += 100) {
    const chunk = tokenIds.slice(i, i + 100);
    const chunkResults = (await client.multicall({
      allowFailure: false,
      contracts: chunk.map((tokenId) => ({
        ...contracts.achievementRegistry,
        functionName: 'getTokenAchievement',
        args: [tokenId],
      })),
    })) as `0x${string}`[];
    hashes.push(...chunkResults);
  }

  const idByHash = new Map(achievementIds.map((id) => [computeAchievementId(id), id]));

  const minted = new Set<string>();
  for (const hash of hashes) {
    const id = idByHash.get(hash);
    if (id) minted.add(id);
  }
  return minted;
}

/**
 * Mints a soulbound achievement badge to the caller's own wallet, defining the
 * achievement type first if it hasn't been registered yet.
 *
 * `mintAchievement` (and `defineAchievement`) are role-gated on-chain (MINTER_ROLE /
 * DEFAULT_ADMIN_ROLE). This only succeeds when the calling wallet holds those roles —
 * true today only in local dev, where every user shares the deployer account. A real
 * multi-user deployment needs a backend holding the minter key instead.
 */
export async function mintAchievement(
  wallet: ReturnType<typeof getWalletClient>,
  id: string,
  name: string
): Promise<{ confirmed: boolean }> {
  if (getChainMode() !== 'local') {
    return relayMintAchievement(
      wallet.account?.address as `0x${string}`,
      computeAchievementId(id),
      name
    );
  }
  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const achievementId = computeAchievementId(id);

  const existing = await getAchievement(id);
  if (!existing.exists) {
    const defineHash = await wallet.writeContract({
      ...contracts.achievementRegistry,
      functionName: 'defineAchievement',
      args: [achievementId, name],
      account,
      chain: config.chain,
    });
    await client.waitForTransactionReceipt({ hash: defineHash });
  }

  const hash = await wallet.writeContract({
    ...contracts.achievementRegistry,
    functionName: 'mintAchievement',
    args: [account, achievementId],
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  return { confirmed: receipt.status === 'success' };
}
