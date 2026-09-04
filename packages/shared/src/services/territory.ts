import { keccak256, toBytes } from 'viem';
import { getActiveConfig, getContracts, getPublicClient, type getWalletClient } from './client';

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
  const flat = polygon.map(([lng, lat]) => `${lng},${lat}`).join('|');
  return keccak256(toBytes(flat));
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
): Promise<{ txHash: `0x${string}` }> {
  const contracts = getContracts();
  const config = getActiveConfig();
  const addresses = await wallet.getAddresses();
  const account = addresses[0];
  if (!account) throw new Error('No wallet account found');

  const polygonHash = computePolygonHash(params.polygon);

  const lngs = params.polygon.map(([lng]) => lng);
  const lats = params.polygon.map(([, lat]) => lat);

  const minLng = toFixedPoint(Math.min(...lngs));
  const minLat = toFixedPoint(Math.min(...lats));
  const maxLng = toFixedPoint(Math.max(...lngs));
  const maxLat = toFixedPoint(Math.max(...lats));

  const strength = params.strength ?? 100;

  const hash = await wallet.writeContract({
    ...contracts.territoryRegistry,
    functionName: 'claimTerritory',
    args: [
      polygonHash,
      BigInt(Math.round(params.areaSqm)),
      BigInt(strength),
      minLng,
      minLat,
      maxLng,
      maxLat,
    ],
    account,
    chain: config.chain,
  });

  return { txHash: hash };
}
