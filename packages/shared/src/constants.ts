import { baseSepolia, type Chain, foundry, sepolia } from 'viem/chains';
import type { ActivityType } from './types';

export type ChainMode = 'ethereum-sepolia' | 'base-sepolia' | 'local';

export interface ChainConfig {
  chain: Chain;
  chainId: number;
  rpcUrl: string;
  /** Empty string means no subgraph is deployed for this mode — callers fall
   * back to reading events directly off-chain (see services/sync.ts). */
  subgraphUrl: string;
  contracts: {
    profileRegistry: `0x${string}`;
    activityRegistry: `0x${string}`;
    territoryRegistry: `0x${string}`;
    seasonManager: `0x${string}`;
    achievementRegistry: `0x${string}`;
    challengeRegistry: `0x${string}`;
    territoryNFT: `0x${string}`;
    moveToEarnToken: `0x${string}`;
  };
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

const DEFAULT_LOCAL_RPC = 'http://127.0.0.1:8545';
let localRpcOverride: string | null = null;

export function setLocalRpcUrl(url: string): void {
  localRpcOverride = url;
}

export function getLocalRpcUrl(): string {
  return localRpcOverride ?? DEFAULT_LOCAL_RPC;
}

const CHAIN_CONFIGS: Record<ChainMode, ChainConfig> = {
  'ethereum-sepolia': {
    chain: sepolia,
    chainId: 11155111,
    // Ankr's free eth_sepolia endpoint now rejects eth_getTransactionReceipt
    // and other calls with "Unauthorized: you must authenticate with an API
    // key" — that silently broke confirmation polling for every on-chain
    // write (activities, challenges, achievements, etc: they'd succeed
    // on-chain but the app would spin for the full 3-minute viem timeout
    // and then report failure). publicnode's endpoint has no such gate.
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    subgraphUrl: 'https://api.studio.thegraph.com/query/1760059/stryde/v0.1.2',
    contracts: {
      profileRegistry: '0xa180433C0818518eda0Ac8c3248dCEE388a689dd',
      activityRegistry: '0xf786Fd52cfCc4c319aC5B43E2F8e856f454Dd5f2',
      territoryRegistry: '0x52fB04Cf2AD5ed767fc66b0Fc70C70E185446B67',
      seasonManager: '0xe36E17c1C61CE0cE5eF1c5EAF5eb17c60f6ce5Ba',
      achievementRegistry: '0x60EcD3Cc3D29aC475E1d84969B442C41B6d0C91C',
      challengeRegistry: '0xA8B8133550F7e9CA15164a3c97a822bdead3e7EE',
      territoryNFT: '0x9AaF0D8f995F9Af99cdb9ab1c3dc599259Ff1643',
      moveToEarnToken: '0x0AdcEfd61531D5fc62f1fFA09b3AcdE602f4C8f6',
    },
  },
  'base-sepolia': {
    chain: baseSepolia,
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    subgraphUrl: '',
    contracts: {
      profileRegistry: ZERO_ADDRESS,
      activityRegistry: ZERO_ADDRESS,
      territoryRegistry: ZERO_ADDRESS,
      seasonManager: ZERO_ADDRESS,
      achievementRegistry: ZERO_ADDRESS,
      challengeRegistry: ZERO_ADDRESS,
      territoryNFT: ZERO_ADDRESS,
      moveToEarnToken: ZERO_ADDRESS,
    },
  },
  local: {
    chain: foundry,
    chainId: 31337,
    rpcUrl: DEFAULT_LOCAL_RPC,
    subgraphUrl: '',
    contracts: {
      profileRegistry: '0xc5a5C42992dECbae36851359345FE25997F5C42d',
      activityRegistry: '0x67d269191c92Caf3cD7723F116c85e6E9bf55933',
      territoryRegistry: '0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E',
      seasonManager: '0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690',
      achievementRegistry: '0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB',
      challengeRegistry: '0x9E545E3C0baAB3E08CdfD552C960A1050f373042',
      territoryNFT: '0xa82fF9aFd8f496c3d6ac40E2a0F282E47488CFc9',
      moveToEarnToken: '0x1613beB3B2C4f22Ee086B2b38C1476A3cE7f78E8',
    },
  },
};

export function getChainConfig(mode: ChainMode): ChainConfig {
  const config = { ...CHAIN_CONFIGS[mode] };
  if (mode === 'local' && localRpcOverride) {
    config.rpcUrl = localRpcOverride;
  }
  return config;
}

export function getChainConfigByChainId(chainId: number): ChainConfig | undefined {
  return Object.values(CHAIN_CONFIGS).find((c) => c.chainId === chainId);
}

export const DEFAULT_CHAIN_MODE: ChainMode = 'ethereum-sepolia';

export const ACTIVITY_TYPES = [
  'run',
  'ride',
  'walk',
  'hike',
  'swim',
  'yoga',
  'workout',
  'hiit',
  'dance',
  'climb',
  'skate',
  'row',
] as const;

export const ACTIVITY_TYPE_MAP: Record<ActivityType, number> = {
  run: 0,
  ride: 1,
  walk: 2,
  hike: 3,
  swim: 4,
  yoga: 5,
  workout: 6,
  hiit: 7,
  dance: 8,
  climb: 9,
  skate: 10,
  row: 11,
};

export const ACTIVITY_TYPE_BY_ID: Record<number, ActivityType> = {
  0: 'run',
  1: 'ride',
  2: 'walk',
  3: 'hike',
  4: 'swim',
  5: 'yoga',
  6: 'workout',
  7: 'hiit',
  8: 'dance',
  9: 'climb',
  10: 'skate',
  11: 'row',
};

export const TERRITORY_MIN_AREA = 1000;

export const SUPPORTED_CHAINS = Object.entries(CHAIN_CONFIGS).map(([mode, config]) => ({
  mode: mode as ChainMode,
  chainId: config.chainId,
  name: config.chain.name,
})) as Array<{ mode: ChainMode; chainId: number; name: string }>;
