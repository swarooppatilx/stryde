import type { StorageAdapter } from '@/platform';
import type { WalletKind } from './walletConnection';

const key = (userId: string) => `@stryde/wallet-kind:${userId}`;

/** Which wallet this user has been using on this device, if any. */
export async function rememberedWalletKind(
  storage: StorageAdapter,
  userId: string
): Promise<WalletKind | null> {
  const value = await storage.getItem(key(userId));
  return value === 'smart' || value === 'embedded' ? value : null;
}

export async function rememberWalletKind(
  storage: StorageAdapter,
  userId: string,
  kind: WalletKind
): Promise<void> {
  await storage.setItem(key(userId), kind);
}

/**
 * A first session can fall back to the embedded wallet and register under that address. Once it
 * has a profile it is this user's onchain identity, so a later session must not swap it for the
 * gas-free wallet. Until then the choice stays open. A failed check locks nothing.
 */
export async function lockFallbackIdentity(
  storage: StorageAdapter,
  userId: string,
  address: `0x${string}`,
  isRegistered: (address: `0x${string}`) => Promise<boolean>
): Promise<void> {
  try {
    if (await isRegistered(address)) await rememberWalletKind(storage, userId, 'embedded');
  } catch {
    // Offline or indexer lag: decide next session.
  }
}
