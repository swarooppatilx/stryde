import type { StorageAdapter } from '@/platform';
import {
  type ConnectOptions,
  connectRemoteWallet,
  type WalletConnection,
} from '@/services/walletConnection';
import { lockFallbackIdentity, rememberWalletKind } from '@/services/walletIdentity';

interface ConnectAndRememberOptions extends ConnectOptions {
  storage: StorageAdapter;
  /** The Privy user the connection belongs to; without one nothing is remembered. */
  privyUserId: string | undefined;
  isRegistered: (address: `0x${string}`) => Promise<boolean>;
}

/**
 * Connects the remote wallet and records which kind this user ended up with, so a later session
 * does not swap one onchain identity for the other.
 */
export async function connectAndRemember({
  storage,
  privyUserId,
  isRegistered,
  ...connect
}: ConnectAndRememberOptions): Promise<WalletConnection> {
  const connection = await connectRemoteWallet(connect);
  if (!privyUserId) return connection;
  if (connection.kind === 'smart' && connect.lockedKind !== 'smart') {
    await rememberWalletKind(storage, privyUserId, 'smart');
  }
  if (connection.kind === 'embedded' && connect.lockedKind === null) {
    await lockFallbackIdentity(storage, privyUserId, connection.address, isRegistered);
  }
  return connection;
}
