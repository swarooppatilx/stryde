import { keccak256, toBytes } from 'viem';
import { getActiveConfig, getContracts, getPublicClient, type getWalletClient } from './client';

const polygonHashCache = new Map<string, `0x${string}`>();

export async function getController(territoryId: `0x${string}`): Promise<`0x${string}`> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.territoryRegistry,
    functionName: 'getController',
    args: [territoryId],
  }) as Promise<`0x${string}`>;
}

export async function getTerritory(territoryId: `0x${string}`) {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.territoryRegistry,
    functionName: 'getTerritory',
    args: [territoryId],
  }) as Promise<{
    controller: `0x${string}`;
    capturedAt: bigint;
    lastReinforced: bigint;
    controlStrength: bigint;
    areaSqm: bigint;
    polygonHash: `0x${string}`;
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  }>;
}

export async function getUserTerritories(user: `0x${string}`): Promise<`0x${string}`[]> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.territoryRegistry,
    functionName: 'getUserTerritories',
    args: [user],
  }) as Promise<`0x${string}`[]>;
}

export async function getUserTerritoryCount(user: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.territoryRegistry,
    functionName: 'getUserTerritoryCount',
    args: [user],
  }) as Promise<bigint>;
}

export async function totalTerritories(): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.territoryRegistry,
    functionName: 'totalTerritories',
  }) as Promise<bigint>;
}

export function computePolygonHash(polygon: Array<[number, number]>): `0x${string}` {
  const key = polygon.map(([lng, lat]) => `${lng},${lat}`).join('|');
  const cached = polygonHashCache.get(key);
  if (cached) return cached;

  const hash = keccak256(toBytes(key));
  polygonHashCache.set(key, hash);
  return hash;
}

function toFixedPoint(value: number): number {
  return Math.round(value * 1e6);
}

export async function claimTerritory(
  wallet: ReturnType<typeof getWalletClient>,
  params: {
    polygon: Array<[number, number]>;
    areaSqm: number;
    strength?: number;
  }
): Promise<{ territoryId: `0x${string}`; txHash: `0x${string}`; confirmed: boolean }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const account = wallet.account?.address;
  if (!account) throw new Error('No wallet account found');

  const polygonHash = computePolygonHash(params.polygon);

  let minLng = Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of params.polygon) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const strength = params.strength ?? 100;

  const hash = await wallet.writeContract({
    ...contracts.territoryRegistry,
    functionName: 'claimTerritory',
    args: [
      polygonHash,
      BigInt(Math.round(params.areaSqm)),
      BigInt(strength),
      toFixedPoint(minLng),
      toFixedPoint(minLat),
      toFixedPoint(maxLng),
      toFixedPoint(maxLat),
    ],
    account,
    chain: config.chain,
  });

  const client = getPublicClient();
  const receipt = await client.waitForTransactionReceipt({ hash });

  return { territoryId: polygonHash, txHash: hash, confirmed: receipt.status === 'success' };
}
