import { keccak256, toBytes } from 'viem';
import { getContracts, getPublicClient, type getWalletClient } from './client';
import { toFixedPoint } from './fixedPoint';
import { writeAndConfirm } from './tx';

const polygonHashCache = new Map<string, `0x${string}`>();

export async function getController(territoryId: `0x${string}`): Promise<`0x${string}`> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.territoryRegistry,
    functionName: 'getController',
    args: [territoryId],
  });
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

export async function getUserTerritories(user: `0x${string}`): Promise<readonly `0x${string}`[]> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.territoryRegistry,
    functionName: 'getUserTerritories',
    args: [user],
  });
}

export async function getUserTerritoryCount(user: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.territoryRegistry,
    functionName: 'getUserTerritoryCount',
    args: [user],
  });
}

export async function totalTerritories(): Promise<bigint> {
  const client = getPublicClient();
  const contracts = getContracts();
  return client.readContract({
    ...contracts.territoryRegistry,
    functionName: 'totalTerritories',
  });
}

export function computePolygonHash(polygon: Array<[number, number]>): `0x${string}` {
  const key = polygon.map(([lng, lat]) => `${lng},${lat}`).join('|');
  const cached = polygonHashCache.get(key);
  if (cached) return cached;

  const hash = keccak256(toBytes(key));
  polygonHashCache.set(key, hash);
  return hash;
}

export async function claimTerritory(
  wallet: ReturnType<typeof getWalletClient>,
  params: {
    polygon: Array<[number, number]>;
    areaSqm: number;
    strength?: number;
  }
): Promise<{ territoryId: `0x${string}`; txHash: `0x${string}`; confirmed: boolean }> {
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

  const { txHash, confirmed } = await writeAndConfirm(wallet, 'territoryRegistry', {
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
  });

  return { territoryId: polygonHash, txHash, confirmed };
}
