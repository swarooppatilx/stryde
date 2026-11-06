import { sepolia } from 'viem/chains';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectAndRemember } from '@/hooks/walletInit';
import { type FakePlatform, installFakePlatform } from '@/platform/fakes';
import type { EmbeddedWalletLike } from '@/services/walletConnection';
import { rememberedWalletKind } from '@/services/walletIdentity';

const SMART = '0x00000000000000000000000000000000000000aa' as const;
const EMBEDDED = '0x00000000000000000000000000000000000000bb' as const;
const USER = 'did:privy:a';

let platform: FakePlatform;
beforeEach(() => {
  platform = installFakePlatform();
});

const embedded = (): EmbeddedWalletLike => ({
  address: EMBEDDED,
  getProvider: vi.fn().mockResolvedValue({ request: vi.fn() }),
});

const options = (overrides: Partial<Parameters<typeof connectAndRemember>[0]> = {}) => ({
  chain: sepolia,
  embedded: embedded(),
  storage: platform.storage,
  privyUserId: USER,
  lockedKind: null,
  isRegistered: async () => false,
  sleep: async () => {},
  getSmartClient: async () => ({ account: { address: SMART } }),
  ...overrides,
});

describe('connectAndRemember', () => {
  it('remembers the smart wallet the first time it connects', async () => {
    const connection = await connectAndRemember(options());

    expect(connection.kind).toBe('smart');
    expect(await rememberedWalletKind(platform.storage, USER)).toBe('smart');
  });

  it('does not rewrite a smart wallet that is already remembered', async () => {
    const setItem = vi.spyOn(platform.storage, 'setItem');

    await connectAndRemember(options({ lockedKind: 'smart' }));

    expect(setItem).not.toHaveBeenCalled();
  });

  it('remembers nothing without a Privy user', async () => {
    const setItem = vi.spyOn(platform.storage, 'setItem');

    const connection = await connectAndRemember(options({ privyUserId: undefined }));

    expect(connection.kind).toBe('smart');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('locks the embedded fallback once it has a registered profile', async () => {
    await connectAndRemember(
      options({ getSmartClient: null, isRegistered: async (a) => a === EMBEDDED })
    );

    expect(await rememberedWalletKind(platform.storage, USER)).toBe('embedded');
  });

  it('leaves the choice open while the embedded fallback has no profile', async () => {
    const connection = await connectAndRemember(options({ getSmartClient: null }));

    expect(connection.kind).toBe('embedded');
    expect(await rememberedWalletKind(platform.storage, USER)).toBeNull();
  });

  it('does not lock an embedded wallet that was already chosen', async () => {
    const isRegistered = vi.fn().mockResolvedValue(true);

    await connectAndRemember(
      options({ getSmartClient: null, lockedKind: 'embedded', isRegistered })
    );

    expect(isRegistered).not.toHaveBeenCalled();
  });
});
