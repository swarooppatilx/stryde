import { getContracts, getPublicClient, type getWalletClient } from './client';
import { relayMintTerritoryNFT } from './relay';

export async function isMinted(polygonHash: `0x${string}`): Promise<boolean> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.territoryNFT,
    functionName: 'isMinted',
    args: [polygonHash],
  });
}

/** Which of the given polygon hashes already have a minted, soulbound territory NFT. */
export async function getMintedTerritoryIds(
  polygonHashes: `0x${string}`[]
): Promise<Set<`0x${string}`>> {
  if (polygonHashes.length === 0) return new Set();

  const client = getPublicClient();
  const contracts = getContracts();
  const results: boolean[] = [];
  for (let i = 0; i < polygonHashes.length; i += 100) {
    const chunk = polygonHashes.slice(i, i + 100);
    const chunkResults = (await client.multicall({
      allowFailure: false,
      contracts: chunk.map((hash) => ({
        ...contracts.territoryNFT,
        functionName: 'isMinted',
        args: [hash],
      })),
    })) as boolean[];
    results.push(...chunkResults);
  }

  const minted = new Set<`0x${string}`>();
  polygonHashes.forEach((hash, i) => {
    if (results[i]) minted.add(hash);
  });
  return minted;
}

/** Asks the relayer to mint a soulbound territory NFT for a captured polygon: `mintTerritory` is MINTER_ROLE-gated, which an athlete's own wallet is not, on any chain. */
export async function mintTerritoryNFT(
  _wallet: ReturnType<typeof getWalletClient>,
  polygonHash: `0x${string}`,
  recipient: `0x${string}`
): Promise<{ confirmed: boolean }> {
  return relayMintTerritoryNFT(recipient, polygonHash);
}
