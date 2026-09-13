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
  profileRegistry: '0x4Aa7127Aa6Cb07202e4040eA5Aa57434F8B67641',
  activityRegistry: '0x8aCAd61B9D875088C010db110d708F85E13e9859',
  territoryRegistry: '0xa5ba09D89C3C6e8F9e84ABD0b73D350220204B6C',
  seasonManager: '0xe1B61aEA4dcD64C2aA20768Dcf94E5a57f7daF65',
  achievementRegistry: '0x95d86d385397Cc264f565555c1a1b416A9b784c6',
  challengeRegistry: '0x107CDb2828b7efB12Fa01ed4f185822441281787',
  territoryNFT: '0x1356C008ea21469275C7298F441F2354e7187C25',
  moveToEarnToken: '0x3BF5cC3fDA8D89D9e0d35B5648Cf2781a94Ee9FA',
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
