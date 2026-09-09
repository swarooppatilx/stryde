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
  profileRegistry: '0xEb5d78a3d1d852a823AF8283d4f6869610b1269a',
  activityRegistry: '0x1A90B0B3D2EDe91eB8C036c2c9Fa82f1654c76Fe',
  territoryRegistry: '0x0437De17688BD16AcD2B793d1446d5E775a056C8',
  seasonManager: '0xE9aB491b2Ca50523EC681476c05db7A5D59Bfc8F',
  achievementRegistry: '0xBD01B26FC06Bf96B58a9811d42c2f180Fe3b8Fc3',
  challengeRegistry: '0x321aFdf640f95c3C9964299767594Cd69DFcB13a',
  territoryNFT: '0xe5c66b5a52CAe8848C848CC548D3054622Ef8aed',
  moveToEarnToken: '0xAb3e840c8C2e811D4D1AbFE98c992f652e722359',
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
