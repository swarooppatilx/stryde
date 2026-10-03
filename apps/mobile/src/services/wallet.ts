import type { WalletClient } from 'viem';
import { logger } from '@/utils/logger';

let activeWallet: WalletClient | null = null;
let activeAddress: `0x${string}` | null = null;

/** Serializes on-chain writes so rapid consecutive calls (e.g. a double-tapped kudos) don't collide on nonce. */
let writeQueue: Promise<unknown> = Promise.resolve();

export function setActiveWallet(wallet: WalletClient | null, address: `0x${string}` | null): void {
  activeWallet = wallet;
  activeAddress = address;
}

export function getActiveWallet(): WalletClient | null {
  return activeWallet;
}

/** Runs `fn` with the active wallet and address once earlier writes finish; resolves null if no wallet is available. */
export async function queuedWrite<T>(
  fn: (wallet: WalletClient, address: `0x${string}`) => Promise<T>
): Promise<T | null> {
  if (!activeWallet || !activeAddress) {
    logger.warn('[wallet] No active wallet for queuedWrite');
    return null;
  }

  const wallet = activeWallet;
  const address = activeAddress;

  const result = writeQueue.then(() => fn(wallet, address));
  // The catch keeps one failed write from stalling the queue.
  writeQueue = result.catch(() => {});
  return result;
}
