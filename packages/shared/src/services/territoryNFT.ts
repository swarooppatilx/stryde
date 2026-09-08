import { getActiveConfig, getContracts, getPublicClient, type getWalletClient } from './client';

export async function isMinted(polygonHash: `0x${string}`): Promise<boolean> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.territoryNFT,
    functionName: 'isMinted',
    args: [polygonHash],
  }) as Promise<boolean>;
}

export async function getOwnedTerritoryIds(owner: `0x${string}`): Promise<bigint[]> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.territoryNFT,
    functionName: 'getTokenIds',
    args: [owner],
  }) as Promise<bigint[]>;
}

/** Which of the given polygon hashes already have a minted, soulbound territory NFT. */
export async function getMintedTerritoryIds(
  polygonHashes: `0x${string}`[]
): Promise<Set<`0x${string}`>> {
  const results = await Promise.all(polygonHashes.map((hash) => isMinted(hash)));
  const minted = new Set<`0x${string}`>();
  polygonHashes.forEach((hash, i) => {
    if (results[i]) minted.add(hash);
  });
  return minted;
}

/**
 * Mints a soulbound territory NFT to the caller's own wallet for a captured polygon.
 *
 * `mintTerritory` is role-gated on-chain (MINTER_ROLE). This only succeeds when the
 * calling wallet holds that role — true today only in local dev, where every user
 * shares the deployer account. A real multi-user deployment needs a backend holding
 * the minter key instead.
 */
export async function mintTerritoryNFT(
  wallet: ReturnType<typeof getWalletClient>,
  polygonHash: `0x${string}`,
  recipient: `0x${string}`
): Promise<{ confirmed: boolean }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.territoryNFT,
    functionName: 'mintTerritory',
    args: [recipient, polygonHash],
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  return { confirmed: receipt.status === 'success' };
}

/** Burns a territory NFT once TerritoryRegistry reports the territory as lost to decay. */
export async function burnTerritoryNFT(
  wallet: ReturnType<typeof getWalletClient>,
  polygonHash: `0x${string}`
): Promise<{ confirmed: boolean }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const client = getPublicClient();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const hash = await wallet.writeContract({
    ...contracts.territoryNFT,
    functionName: 'burnTerritory',
    args: [polygonHash],
    account,
    chain: config.chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  return { confirmed: receipt.status === 'success' };
}
