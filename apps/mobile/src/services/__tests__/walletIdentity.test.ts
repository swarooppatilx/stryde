import { beforeEach, describe, expect, it } from 'vitest';
import { type FakePlatform, installFakePlatform } from '@/platform/fakes';
import {
  lockFallbackIdentity,
  rememberedWalletKind,
  rememberWalletKind,
} from '@/services/walletIdentity';

let platform: FakePlatform;
beforeEach(() => {
  platform = installFakePlatform();
});

describe('wallet identity memory', () => {
  it('has nothing for a user who never connected', async () => {
    expect(await rememberedWalletKind(platform.storage, 'did:privy:a')).toBeNull();
  });

  it('remembers the kind per user', async () => {
    await rememberWalletKind(platform.storage, 'did:privy:a', 'smart');
    await rememberWalletKind(platform.storage, 'did:privy:b', 'embedded');

    expect(await rememberedWalletKind(platform.storage, 'did:privy:a')).toBe('smart');
    expect(await rememberedWalletKind(platform.storage, 'did:privy:b')).toBe('embedded');
  });

  it('ignores a value it does not recognise', async () => {
    await platform.storage.setItem('@stryde/wallet-kind:did:privy:a', 'something-else');

    expect(await rememberedWalletKind(platform.storage, 'did:privy:a')).toBeNull();
  });
});

describe('locking a fallback identity', () => {
  const user = 'did:privy:a';
  const address = '0x0000000000000000000000000000000000000001' as const;

  it('locks the embedded wallet once it has a registered profile', async () => {
    await lockFallbackIdentity(platform.storage, user, address, async () => true);

    expect(await rememberedWalletKind(platform.storage, user)).toBe('embedded');
  });

  it('stays open while the embedded wallet has no profile, so the gas-free one can still win', async () => {
    await lockFallbackIdentity(platform.storage, user, address, async () => false);

    expect(await rememberedWalletKind(platform.storage, user)).toBeNull();
  });

  it('does not lock when the registration check fails', async () => {
    await lockFallbackIdentity(platform.storage, user, address, async () => {
      throw new Error('offline');
    });

    expect(await rememberedWalletKind(platform.storage, user)).toBeNull();
  });
});
