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
    /** Not yet deployed to any network — see GroupRegistry PR notes. Zero
     * address on every chain mode until a human runs the deploy script. */
    groupRegistry: `0x${string}`;
    socialRegistry: `0x${string}`;
    eventRegistry: `0x${string}`;
  };
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

const DEFAULT_LOCAL_RPC = 'http://127.0.0.1:8545';
let localRpcOverride: string | null = null;

let chainConfigCache: { key: string; config: ChainConfig } | null = null;

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
    subgraphUrl: 'https://api.studio.thegraph.com/query/1760059/stryde/v0.5.0',
    contracts: {
      profileRegistry: '0x4Aa7127Aa6Cb07202e4040eA5Aa57434F8B67641',
      activityRegistry: '0x8aCAd61B9D875088C010db110d708F85E13e9859',
      territoryRegistry: '0xa5ba09D89C3C6e8F9e84ABD0b73D350220204B6C',
      seasonManager: '0xe1B61aEA4dcD64C2aA20768Dcf94E5a57f7daF65',
      achievementRegistry: '0x95d86d385397Cc264f565555c1a1b416A9b784c6',
      challengeRegistry: '0x107CDb2828b7efB12Fa01ed4f185822441281787',
      territoryNFT: '0x1356C008ea21469275C7298F441F2354e7187C25',
      moveToEarnToken: '0x3BF5cC3fDA8D89D9e0d35B5648Cf2781a94Ee9FA',
      groupRegistry: '0xcE8466Ea9BBC35cF3f4516ab2D0aAe3DB919B62d',
      socialRegistry: '0xdd5052dD38c900Da0864FAc5c26b4f41322d9bBC',
      eventRegistry: ZERO_ADDRESS,
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
      groupRegistry: ZERO_ADDRESS,
      socialRegistry: ZERO_ADDRESS,
      eventRegistry: ZERO_ADDRESS,
    },
  },
  local: {
    chain: foundry,
    chainId: 31337,
    rpcUrl: DEFAULT_LOCAL_RPC,
    subgraphUrl: '',
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
  const effectiveRpcUrl =
    mode === 'local' && localRpcOverride ? localRpcOverride : CHAIN_CONFIGS[mode].rpcUrl;
  const key = `${mode}:${effectiveRpcUrl}`;

  if (chainConfigCache?.key === key) {
    return chainConfigCache.config;
  }

  const config = { ...CHAIN_CONFIGS[mode] };
  if (mode === 'local' && localRpcOverride) {
    config.rpcUrl = localRpcOverride;
  }

  chainConfigCache = { key, config };
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
