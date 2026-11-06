import { type Chain, foundry, sepolia } from 'viem/chains';

export interface RelayChainConfig {
  chain: Chain;
  chainId: number;
  rpcUrl: string;
  /** First block of the current deployment; log scans start here. */
  deployBlock: bigint;
  /** Empty when no subgraph indexes this chain (local Anvil). */
  subgraphUrl: string;
  contracts: Record<string, `0x${string}`>;
}

const CHAIN_ID = Number(process.env.RELAYER_CHAIN_ID);
const RPC_URL = process.env.RELAYER_RPC_URL;

// Exported so a test can assert parity with packages/shared's constants.ts.
export const SEPOLIA_CONTRACTS: Record<string, `0x${string}`> = {
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
};

// Anvil deploys from its default account #0 at nonce 0 give deterministic
// addresses — kept in sync with packages/shared's `local` chain config
// (packages/contracts/scripts/deploy-local.sh rewrites both).
export const LOCAL_CONTRACTS: Record<string, `0x${string}`> = {
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
};

let _config: RelayChainConfig | null = null;

export function getRelayChainConfig(): RelayChainConfig {
  if (_config) return _config;
  if (!RPC_URL) throw new Error('[relay] Missing RELAYER_RPC_URL');
  if (!CHAIN_ID) throw new Error('[relay] Missing RELAYER_CHAIN_ID');

  const chainMap: Record<
    number,
    {
      chain: Chain;
      deployBlock: bigint;
      subgraphUrl: string;
      contracts: Record<string, `0x${string}`>;
    }
  > = {
    11155111: {
      chain: sepolia,
      deployBlock: 12_063_931n,
      // Empty on purpose: see packages/shared/src/constants.ts.
      subgraphUrl: '',
      contracts: SEPOLIA_CONTRACTS,
    },
    31337: { chain: foundry, deployBlock: 0n, subgraphUrl: '', contracts: LOCAL_CONTRACTS },
  };

  const entry = chainMap[CHAIN_ID];
  if (!entry) throw new Error(`[relay] Unsupported chain ID: ${CHAIN_ID}`);

  _config = {
    chain: entry.chain,
    chainId: CHAIN_ID,
    rpcUrl: RPC_URL,
    deployBlock: entry.deployBlock,
    subgraphUrl: entry.subgraphUrl,
    contracts: entry.contracts,
  };
  return _config;
}

export function contractAddress(config: RelayChainConfig, name: string): `0x${string}` {
  const address = config.contracts[name];
  if (!address) throw new Error(`[relay] Contract not deployed on this chain: ${name}`);
  return address;
}
