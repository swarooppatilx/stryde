import { type Chain, foundry, sepolia } from 'viem/chains';

export interface RelayChainConfig {
  chain: Chain;
  chainId: number;
  rpcUrl: string;
  contracts: Record<string, `0x${string}`>;
}

const CHAIN_ID = Number(process.env.RELAYER_CHAIN_ID);
const RPC_URL = process.env.RELAYER_RPC_URL;

const SEPOLIA_CONTRACTS: Record<string, `0x${string}`> = {
  profileRegistry: '0x7F7C12C204229A76815470707De2384cd369bA23',
  activityRegistry: '0x569dFFc017a0040E381AE859dCfd34Ff7fB94b1c',
  territoryRegistry: '0x47A345474256c297eB78e28F1Eb5026269b8220a',
  seasonManager: '0xE4a98F8eEe705a9114d8BED7a9064Cc00be14CcD',
  achievementRegistry: '0x545945D83ff0dee4dBE993884E6951eA994Bbe8E',
  challengeRegistry: '0x0a149740740927270326C7014e7c04Aa5A0A299D',
  territoryNFT: '0xf1d2263C51c3FE311325Da69a48df1049A52EB07',
  moveToEarnToken: '0xa154f1E0A9dAb00F107668B1dEe7DE9fA187Eae5',
};

// Anvil deploys from its default account #0 at nonce 0 give deterministic
// addresses — kept in sync with packages/shared's `local` chain config
// (packages/contracts/scripts/deploy-local.sh rewrites both).
const LOCAL_CONTRACTS: Record<string, `0x${string}`> = {
  profileRegistry: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  activityRegistry: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  territoryRegistry: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  seasonManager: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  achievementRegistry: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
  challengeRegistry: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
  territoryNFT: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
  moveToEarnToken: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
};

let _config: RelayChainConfig | null = null;

export function getRelayChainConfig(): RelayChainConfig {
  if (_config) return _config;
  if (!RPC_URL) throw new Error('[relay] Missing RELAYER_RPC_URL');
  if (!CHAIN_ID) throw new Error('[relay] Missing RELAYER_CHAIN_ID');

  const chainMap: Record<number, { chain: Chain; contracts: Record<string, `0x${string}`> }> = {
    11155111: { chain: sepolia, contracts: SEPOLIA_CONTRACTS },
    31337: { chain: foundry, contracts: LOCAL_CONTRACTS },
  };

  const entry = chainMap[CHAIN_ID];
  if (!entry) throw new Error(`[relay] Unsupported chain ID: ${CHAIN_ID}`);

  _config = {
    chain: entry.chain,
    chainId: CHAIN_ID,
    rpcUrl: RPC_URL,
    contracts: entry.contracts,
  };
  return _config;
}
