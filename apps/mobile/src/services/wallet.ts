import type { WalletClient } from 'viem';

let activeWallet: WalletClient | null = null;
let activeAddress: `0x${string}` | null = null;

/** Module-level write queue: serializes on-chain writes so rapid consecutive
 * calls (e.g. user taps kudos twice) don't collide on nonce. Each call
 * awaits the previous before sending. */
let writeQueue: Promise<unknown> = Promise.resolve();

export function setActiveWallet(wallet: WalletClient | null, address: `0x${string}` | null): void {
  activeWallet = wallet;
  activeAddress = address;
}

export function getActiveWallet(): WalletClient | null {
  return activeWallet;
}

export function getActiveAddress(): `0x${string}` | null {
  return activeAddress;
}

/** Queues an on-chain write function so only one tx is in flight at a time.
 * The fn is invoked with the active wallet and address. Returns the result
 * of fn, or null if no wallet is available. */
export async function queuedWrite<T>(
  fn: (wallet: WalletClient, address: `0x${string}`) => Promise<T>
): Promise<T | null> {
  if (!activeWallet || !activeAddress) {
    console.warn('[wallet] No active wallet for queuedWrite');
    return null;
  }

  const wallet = activeWallet;
  const address = activeAddress;

  const result = writeQueue.then(() => fn(wallet, address));
  // Chain next write after this one completes (catch to prevent queue stall)
  writeQueue = result.catch(() => {});
  return result;
}
