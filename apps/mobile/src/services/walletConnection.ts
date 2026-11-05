import { type Chain, createWalletClient, custom, type WalletClient } from 'viem';
import { retryWithBackoff } from '@/utils/retry';

export interface EmbeddedWalletLike {
  address: string;
  getProvider(): Promise<unknown>;
}

export interface SmartClientLike {
  account: { address: `0x${string}` };
}

export type WalletKind = 'smart' | 'embedded';

export interface WalletConnection {
  wallet: WalletClient;
  address: `0x${string}`;
  /** 'smart' = gas-free ERC-4337 account; 'embedded' = plain wallet that pays its own gas. */
  kind: WalletKind;
}

/** The user's gas-free wallet couldn't be reached; the user is not switched to a different address. */
export class SmartWalletUnavailableError extends Error {
  constructor() {
    super("Your gas-free wallet isn't available right now. Check your connection and retry.");
    this.name = 'SmartWalletUnavailableError';
  }
}

export interface ConnectOptions {
  chain: Chain;
  embedded: EmbeddedWalletLike;
  /** Resolves the smart-wallet client for a chain id; null skips the gas-free path entirely. */
  getSmartClient: ((chainId: number) => Promise<SmartClientLike>) | null;
  sleep?: (ms: number) => Promise<void>;
  /** Called when the smart wallet could not be used and the embedded wallet was used instead. */
  onFallback?: (error: unknown) => void;
  /**
   * The kind this user already has. The two wallets are different addresses (different
   * onchain identities), so a known identity is never swapped for the other one.
   */
  lockedKind?: WalletKind | null;
}

/**
 * Privy provisions the smart wallet server-side after login (ping, init challenge, sign, link), and asking
 * earlier throws a generic "could not create client", so retry. The embedded wallet is a different address,
 * i.e. a different onchain identity, so wait generously before falling back.
 */
/** 6 attempts, pausing 1+2+4+8+16 s: about 31 s before falling back. */
const SMART_WALLET_ATTEMPTS = 6;
const SMART_WALLET_RETRY_BASE_MS = 1000;

/**
 * Prefers the gas-free smart account. If that path is broken (paymaster
 * misconfigured, Privy outage) it falls back to the embedded wallet so writes
 * still work, paid in the wallet's own gas, instead of leaving the user with
 * no wallet at all.
 */
export async function connectRemoteWallet(options: ConnectOptions): Promise<WalletConnection> {
  const { chain, embedded, getSmartClient, sleep, onFallback, lockedKind } = options;

  if (lockedKind !== 'embedded' && getSmartClient) {
    try {
      const client = await retryWithBackoff(() => getSmartClient(chain.id), {
        retries: SMART_WALLET_ATTEMPTS,
        baseMs: SMART_WALLET_RETRY_BASE_MS,
        sleep,
      });
      return {
        wallet: client as unknown as WalletClient,
        address: client.account.address,
        kind: 'smart',
      };
    } catch (error) {
      if (lockedKind === 'smart') throw new SmartWalletUnavailableError();
      onFallback?.(error);
    }
  }

  const address = embedded.address as `0x${string}`;
  const provider = (await embedded.getProvider()) as Parameters<typeof custom>[0];
  return {
    wallet: createWalletClient({ chain, transport: custom(provider), account: address }),
    address,
    kind: 'embedded',
  };
}
