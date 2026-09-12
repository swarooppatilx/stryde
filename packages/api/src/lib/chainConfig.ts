import { sepolia, type Chain } from 'viem/chains';

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

let _config: RelayChainConfig | null = null;

export function getRelayChainConfig(): RelayChainConfig {
  if (_config) return _config;
  if (!RPC_URL) throw new Error('[relay] Missing RELAYER_RPC_URL');
  if (!CHAIN_ID) throw new Error('[relay] Missing RELAYER_CHAIN_ID');

  const chainMap: Record<number, Chain> = {
    11155111: sepolia,
  };

  const chain = chainMap[CHAIN_ID];
  if (!chain) throw new Error(`[relay] Unsupported chain ID: ${CHAIN_ID}`);

  _config = {
    chain,
    chainId: CHAIN_ID,
    rpcUrl: RPC_URL,
    contracts: SEPOLIA_CONTRACTS,
  };
  return _config;
}
