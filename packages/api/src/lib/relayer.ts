import {
  createPublicClient,
  createWalletClient,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { type ChainMode, getChainConfig } from '@repo/shared/constants';

let _wallet: ReturnType<typeof createWalletClient> | null = null;
let _public: ReturnType<typeof createPublicClient> | null = null;
let _address: `0x${string}` | null = null;

function envOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[relayer] Missing env var: ${name}`);
  return value;
}

function resolveChain(chainId: number) {
  const modes: Record<number, ChainMode> = {
    11155111: 'ethereum-sepolia',
    84532: 'base-sepolia',
    31337: 'local',
  };
  const mode = modes[chainId];
  if (!mode) throw new Error(`[relayer] Unknown chain ID ${chainId}`);
  return getChainConfig(mode);
}

export function getRelayerWallet(): ReturnType<typeof createWalletClient> {
  if (_wallet) return _wallet;
  const privateKey = envOrThrow('RELAYER_PRIVATE_KEY') as `0x${string}`;
  const chainId = Number(envOrThrow('RELAYER_CHAIN_ID'));
  const rpcUrl = envOrThrow('RELAYER_RPC_URL');
  const { chain } = resolveChain(chainId);
  const account = privateKeyToAccount(privateKey);
  _address = account.address;
  _wallet = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl, { retryCount: 3, retryDelay: 1000 }),
  });
  console.log(`[relayer] Initialised wallet ${account.address} on chain ${chainId}`);
  return _wallet;
}

export function getRelayerPublicClient(): ReturnType<typeof createPublicClient> {
  if (_public) return _public;
  const chainId = Number(envOrThrow('RELAYER_CHAIN_ID'));
  const rpcUrl = envOrThrow('RELAYER_RPC_URL');
  const { chain } = resolveChain(chainId);
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl, { retryCount: 3, retryDelay: 1000 }),
    batch: { multicall: true },
  });
  _public = client;
  return client;
}

export function getRelayerAddress(): `0x${string}` {
  if (_address) return _address;
  getRelayerWallet();
  return _address!;
}
