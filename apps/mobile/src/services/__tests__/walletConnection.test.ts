import { sepolia } from 'viem/chains';
import { describe, expect, it, vi } from 'vitest';
import {
  connectRemoteWallet,
  type EmbeddedWalletLike,
  SmartWalletUnavailableError,
} from '@/services/walletConnection';

const SMART = '0x00000000000000000000000000000000000000aa' as const;
const EMBEDDED = '0x00000000000000000000000000000000000000bb';

const embedded = (): EmbeddedWalletLike => ({
  address: EMBEDDED,
  getProvider: vi.fn().mockResolvedValue({ request: vi.fn() }),
});
const noWait = async () => {};

describe('connectRemoteWallet', () => {
  it('uses the gas-free smart wallet when it is available', async () => {
    const smartClient = { account: { address: SMART } };

    const connection = await connectRemoteWallet({
      chain: sepolia,
      embedded: embedded(),
      getSmartClient: async () => smartClient,
      sleep: noWait,
    });

    expect(connection.kind).toBe('smart');
    expect(connection.address).toBe(SMART);
    expect(connection.wallet).toBe(smartClient);
  });

  it('asks for the smart client on the right chain', async () => {
    const getSmartClient = vi.fn().mockResolvedValue({ account: { address: SMART } });

    await connectRemoteWallet({
      chain: sepolia,
      embedded: embedded(),
      getSmartClient,
      sleep: noWait,
    });

    expect(getSmartClient).toHaveBeenCalledWith(sepolia.id);
  });

  // Right after login Privy is still provisioning the smart wallet; the first
  // attempts fail even with a perfect dashboard config.
  it('keeps trying while the smart wallet is still being set up', async () => {
    const getSmartClient = vi
      .fn()
      .mockRejectedValueOnce(new Error('not ready'))
      .mockRejectedValueOnce(new Error('not ready'))
      .mockResolvedValue({ account: { address: SMART } });

    const connection = await connectRemoteWallet({
      chain: sepolia,
      embedded: embedded(),
      getSmartClient,
      sleep: noWait,
    });

    expect(connection.kind).toBe('smart');
    expect(getSmartClient).toHaveBeenCalledTimes(3);
  });

  // First-time setup took ~48 s on a real phone and later launches sometimes
  // need 10 s+: giving up early switches the user to a different address.
  it('waits at least 30 seconds in total before giving up on the smart wallet', async () => {
    const waited: number[] = [];

    await connectRemoteWallet({
      chain: sepolia,
      embedded: embedded(),
      getSmartClient: async () => {
        throw new Error('not ready');
      },
      sleep: async (ms) => {
        waited.push(ms);
      },
    });

    expect(waited.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(30_000);
  });

  it('falls back to the embedded wallet when the smart wallet never comes up, and says so', async () => {
    const onFallback = vi.fn();
    const failure = new Error('paymaster misconfigured');

    const connection = await connectRemoteWallet({
      chain: sepolia,
      embedded: embedded(),
      getSmartClient: async () => {
        throw failure;
      },
      sleep: noWait,
      onFallback,
    });

    expect(connection.kind).toBe('embedded');
    expect(connection.address).toBe(EMBEDDED);
    expect(connection.wallet.account?.address).toBe(EMBEDDED);
    expect(onFallback).toHaveBeenCalledWith(failure);
  });

  it('goes straight to the embedded wallet when gas-free mode is off', async () => {
    const onFallback = vi.fn();

    const connection = await connectRemoteWallet({
      chain: sepolia,
      embedded: embedded(),
      getSmartClient: null,
      onFallback,
    });

    expect(connection.kind).toBe('embedded');
    expect(onFallback).not.toHaveBeenCalled();
  });

  it('fails when even the embedded wallet cannot provide a signer', async () => {
    const broken: EmbeddedWalletLike = {
      address: EMBEDDED,
      getProvider: vi.fn().mockRejectedValue(new Error('no provider')),
    };

    await expect(
      connectRemoteWallet({ chain: sepolia, embedded: broken, getSmartClient: null })
    ).rejects.toThrow('no provider');
  });
});

// The smart wallet and the embedded wallet are two different addresses, i.e. two
// different onchain identities. Once a user has one, silently switching to the
// other would make their profile, activities and balance disappear.
describe('connectRemoteWallet with an identity already chosen', () => {
  const failing = async () => {
    throw new Error('not ready');
  };

  it('stays on the smart wallet and reports it unavailable instead of switching address', async () => {
    const onFallback = vi.fn();
    const provider = embedded();

    await expect(
      connectRemoteWallet({
        chain: sepolia,
        embedded: provider,
        getSmartClient: failing,
        lockedKind: 'smart',
        sleep: noWait,
        onFallback,
      })
    ).rejects.toBeInstanceOf(SmartWalletUnavailableError);
    expect(onFallback).not.toHaveBeenCalled();
    expect(provider.getProvider).not.toHaveBeenCalled();
  });

  it('connects the smart wallet as usual when it works', async () => {
    const connection = await connectRemoteWallet({
      chain: sepolia,
      embedded: embedded(),
      getSmartClient: async () => ({ account: { address: SMART } }),
      lockedKind: 'smart',
      sleep: noWait,
    });

    expect(connection).toMatchObject({ kind: 'smart', address: SMART });
  });

  it('stays on the embedded wallet without even asking for the smart one', async () => {
    const getSmartClient = vi.fn();

    const connection = await connectRemoteWallet({
      chain: sepolia,
      embedded: embedded(),
      getSmartClient,
      lockedKind: 'embedded',
      sleep: noWait,
    });

    expect(connection).toMatchObject({ kind: 'embedded', address: EMBEDDED });
    expect(getSmartClient).not.toHaveBeenCalled();
  });
});
