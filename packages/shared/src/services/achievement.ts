import { keccak256, toBytes } from 'viem';
import { getContracts, getPublicClient, type getWalletClient } from './client';
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
  });
}

export async function getTokenIds(user: `0x${string}`): Promise<readonly bigint[]> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.achievementRegistry,
    functionName: 'getTokenIds',
    args: [user],
  });
}

export async function getTokenAchievement(tokenId: bigint): Promise<`0x${string}`> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.achievementRegistry,
    functionName: 'getTokenAchievement',
    args: [tokenId],
  });
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

/** Asks the relayer to mint a soulbound badge to the caller's wallet, defining the achievement type first if needed: `mintAchievement` and `defineAchievement` are role-gated, which an athlete's own wallet is not, on any chain. */
export async function mintAchievement(
  wallet: ReturnType<typeof getWalletClient>,
  id: string,
  name: string
): Promise<{ confirmed: boolean }> {
  return relayMintAchievement(
    wallet.account?.address as `0x${string}`,
    computeAchievementId(id),
    name
  );
}
