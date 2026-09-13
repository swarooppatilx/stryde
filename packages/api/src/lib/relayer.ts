import {
  createPublicClient,
  createWalletClient,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getRelayChainConfig } from './chainConfig.js';

let _wallet: ReturnType<typeof createWalletClient> | null = null;
let _public: ReturnType<typeof createPublicClient> | null = null;
let _address: `0x${string}` | null = null;

function envOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[relayer] Missing env var: ${name}`);
  return value;
}

export function getRelayerWallet(): ReturnType<typeof createWalletClient> {
  if (_wallet) return _wallet;
  const privateKey = envOrThrow('RELAYER_PRIVATE_KEY') as `0x${string}`;
  const config = getRelayChainConfig();
  const account = privateKeyToAccount(privateKey);
  _address = account.address;
  _wallet = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl, { retryCount: 3, retryDelay: 1000 }),
  });
  console.log(`[relayer] Initialised wallet ${account.address} on chain ${config.chainId}`);
  return _wallet;
}

export function getRelayerPublicClient(): ReturnType<typeof createPublicClient> {
  if (_public) return _public;
  const config = getRelayChainConfig();
  const client = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl, { retryCount: 3, retryDelay: 1000 }),
    // Anvil has no Multicall3 deployed, so only batch where the chain has it.
    batch: { multicall: !!config.chain.contracts?.multicall3 },
  });
  _public = client;
  return client;
}

export function getRelayerAddress(): `0x${string}` {
  if (_address) return _address;
  getRelayerWallet();
  return _address!;
}
