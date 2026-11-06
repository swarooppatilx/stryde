import { createPublicClient, createWalletClient } from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { http, type LocalAccount } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ConfigError } from './relayErrors.js';

/** Rabdi (chain 7794095), the Arkiv testnet that replaced Tiramisu. The key goes in a header, never into this URL. */
const OFFICIAL_RPC = 'https://rpc.rabdi.db-chain.testnet.arkiv.network';
/**
 * The keyed Rabdi endpoint can take over 10s to answer the first call after a quiet spell. Requests are not
 * retried (a resent transaction would fail as "already known"), so the timeout has to cover that wait.
 */
const REQUEST_TIMEOUT_MS = 30_000;
const PRIVATE_KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export interface ArkivConfig {
  rpcUrl?: string;
  accessKey?: string;
  fetchFn?: typeof fetch;
}

/** Server-only: the access key must never reach the mobile bundle. */
export function arkivConfigFromEnv(
  env: Record<string, string | undefined> = process.env
): ArkivConfig {
  // ARKIV_RABDI_ACCESS_KEY first: keys are issued per network, so the Tiramisu key in ARKIV_ACCESS_KEY is not valid here.
  return { accessKey: env.ARKIV_RABDI_ACCESS_KEY || env.ARKIV_ACCESS_KEY || undefined };
}

export function arkivSignerFromEnv(
  env: Record<string, string | undefined> = process.env
): LocalAccount {
  const key = env.ARKIV_PRIVATE_KEY;
  if (!key) throw new ConfigError('ARKIV_PRIVATE_KEY');
  if (!PRIVATE_KEY_PATTERN.test(key)) {
    throw new Error('ARKIV_PRIVATE_KEY must be a 0x-prefixed 32-byte hex key');
  }
  return privateKeyToAccount(key as `0x${string}`);
}

function transportFor({ rpcUrl = OFFICIAL_RPC, accessKey, fetchFn }: ArkivConfig) {
  if (accessKey && new URL(rpcUrl).origin !== new URL(OFFICIAL_RPC).origin) {
    throw new Error('Refusing to send the Arkiv access key to a different origin');
  }
  return http(rpcUrl, {
    fetchFn,
    retryCount: 0,
    timeout: REQUEST_TIMEOUT_MS,
    fetchOptions: {
      cache: 'no-store',
      redirect: 'error',
      ...(accessKey ? { headers: { 'X-API-KEY': accessKey } } : {}),
    },
  });
}

/** The chain object only names the network; the URL it would carry the key in is never used (see `transportFor`). */
function chainFor(config: ArkivConfig) {
  return rabdi({ accessKey: config.accessKey ?? '' });
}

export function createArkivPublicClient(config: ArkivConfig = {}) {
  return createPublicClient({
    chain: chainFor(config),
    cacheTime: 0,
    transport: transportFor(config),
  });
}

export function createArkivWalletClient(account: LocalAccount, config: ArkivConfig = {}) {
  return createWalletClient({
    account,
    chain: chainFor(config),
    cacheTime: 0,
    transport: transportFor(config),
  });
}
