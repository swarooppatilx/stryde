import { zeroAddress } from 'viem';
import { baseSepolia, type Chain, foundry, sepolia } from 'viem/chains';
import type { ActivityType } from './types';

export type ChainMode = 'ethereum-sepolia' | 'base-sepolia' | 'local';

export interface ChainConfig {
  chain: Chain;
  chainId: number;
  rpcUrl: string;
  /** Empty string means no subgraph is deployed for this mode; callers read events directly (see services/sync.ts). */
  subgraphUrl: string;
  /** First block of the current deployment; event scans start here instead of at genesis. */
  deployBlock: bigint;
  contracts: {
    profileRegistry: `0x${string}`;
    activityRegistry: `0x${string}`;
    territoryRegistry: `0x${string}`;
    seasonManager: `0x${string}`;
    achievementRegistry: `0x${string}`;
    challengeRegistry: `0x${string}`;
    territoryNFT: `0x${string}`;
    moveToEarnToken: `0x${string}`;
    /** Zero address on every chain mode until the deploy script runs. */
    groupRegistry: `0x${string}`;
    socialRegistry: `0x${string}`;
    eventRegistry: `0x${string}`;
  };
}

const DEFAULT_LOCAL_RPC = 'http://127.0.0.1:8545';
let localRpcOverride: string | null = null;
let sepoliaRpcOverride: string | null = null;

let chainConfigCache: { key: string; config: ChainConfig } | null = null;

export function setLocalRpcUrl(url: string): void {
  localRpcOverride = url;
}

/** Keyed RPC for Ethereum Sepolia; public endpoints prune old logs and rate-limit shared IPs. */
export function setSepoliaRpcUrl(url: string): void {
  sepoliaRpcOverride = url || null;
}

export function getLocalRpcUrl(): string {
  return localRpcOverride ?? DEFAULT_LOCAL_RPC;
}

const CHAIN_CONFIGS: Record<ChainMode, ChainConfig> = {
  'ethereum-sepolia': {
    chain: sepolia,
    chainId: 11155111,
    // Ankr's free eth_sepolia endpoint rejects eth_getTransactionReceipt without an API key, which breaks confirmation polling (writes succeed but the app spins for the 3-minute viem timeout); publicnode has no such gate.
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    // Empty on purpose: the v0.6.0 subgraph indexes the previous deployment's addresses. Reads use the chain-log fallbacks until the Arkiv index serves them.
    subgraphUrl: '',
    deployBlock: 12063931n,
    contracts: {
      profileRegistry: '0x348CE6aF8eA0C50fb44F284dCCA73b7EE5112314',
      activityRegistry: '0x30a910fc25F0977907Af86345c0B26C34e7d2439',
      territoryRegistry: '0x22802b1C6fda5CA6FBC519830879a17214DbA1e2',
      seasonManager: '0xfc42018ea93384FA6703d0Eb72656C67261D1732',
      achievementRegistry: '0x537F289b59b9944e14978a23f57133B738747f81',
      challengeRegistry: '0x6E196c21292E0eDE7748A04A5a62bE0b6ae6004c',
      territoryNFT: '0xfC9044241B4edA72779d9F9876426D256048531B',
      moveToEarnToken: '0x6Cc5211470De17d69B3208e26B08fFAD0b6260F6',
      groupRegistry: '0xeeBBd3aAADcC95919e6f3a78E3A2cdA57D0a3241',
      socialRegistry: '0xfc97445a56b61471720EF9e2bb0759d8d3c76561',
      eventRegistry: '0xDead8aA0b3840f272c8293E6DD34932cF5a7f027',
    },
  },
  'base-sepolia': {
    chain: baseSepolia,
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    subgraphUrl: '',
    deployBlock: 0n,
    contracts: {
      profileRegistry: zeroAddress,
      activityRegistry: zeroAddress,
      territoryRegistry: zeroAddress,
      seasonManager: zeroAddress,
      achievementRegistry: zeroAddress,
      challengeRegistry: zeroAddress,
      territoryNFT: zeroAddress,
      moveToEarnToken: zeroAddress,
      groupRegistry: zeroAddress,
      socialRegistry: zeroAddress,
      eventRegistry: zeroAddress,
    },
  },
  local: {
    chain: foundry,
    chainId: 31337,
    rpcUrl: DEFAULT_LOCAL_RPC,
    subgraphUrl: '',
    deployBlock: 0n,
    contracts: {
      profileRegistry: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      activityRegistry: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      territoryRegistry: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      seasonManager: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
      achievementRegistry: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
      challengeRegistry: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
      territoryNFT: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
      moveToEarnToken: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
      groupRegistry: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
      socialRegistry: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
      eventRegistry: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
    },
  },
};

export function getChainConfig(mode: ChainMode): ChainConfig {
  const override =
    (mode === 'local' && localRpcOverride) ||
    (mode === 'ethereum-sepolia' && sepoliaRpcOverride) ||
    null;
  const effectiveRpcUrl = override ?? CHAIN_CONFIGS[mode].rpcUrl;
  const key = `${mode}:${effectiveRpcUrl}`;

  if (chainConfigCache?.key === key) {
    return chainConfigCache.config;
  }

  const config = { ...CHAIN_CONFIGS[mode], rpcUrl: effectiveRpcUrl };

  chainConfigCache = { key, config };
  return config;
}

export const DEFAULT_CHAIN_MODE: ChainMode = 'ethereum-sepolia';

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
