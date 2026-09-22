import { describe, expect, it, vi } from 'vitest';

vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>();
  return {
    ...actual,
    getPublicClient: () => ({
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success', logs: [] }),
    }),
  };
});

const { register, setUsername } = await import('../profile');

describe('profile.register', () => {
  // A smart-account client (Privy/permissionless) builds a user operation
  // from its account object — account.encodeCalls etc. Passing only the
  // address made viem swap in a bare JSON-RPC account and crash with
  // "undefined is not a function", so registration never worked gasless.
  it('passes the wallet account object, not just its address', async () => {
    const account = {
      address: '0x00000000000000000000000000000000000000aa',
      type: 'smart',
      encodeCalls: vi.fn(),
    };
    const writeContract = vi.fn().mockResolvedValue(`0x${'11'.repeat(32)}`);
    const wallet = { account, writeContract } as unknown as Parameters<typeof register>[0];

    await register(wallet, 'runner');

    expect(writeContract).toHaveBeenCalledOnce();
    expect(writeContract).toHaveBeenCalledWith(expect.objectContaining({ account }));
  });
});

describe('profile.setUsername', () => {
  const account = {
    address: '0x00000000000000000000000000000000000000aa',
    type: 'smart',
    encodeCalls: vi.fn(),
  };

  it('writes the new name through the wallet account and reports it confirmed', async () => {
    const writeContract = vi.fn().mockResolvedValue(`0x${'22'.repeat(32)}`);
    const wallet = { account, writeContract } as unknown as Parameters<typeof setUsername>[0];

    const result = await setUsername(wallet, 'new_name');

    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'setUsername', args: ['new_name'], account })
    );
    expect(result).toEqual({ txHash: `0x${'22'.repeat(32)}`, confirmed: true });
  });

  it('refuses to write without a wallet account', async () => {
    const wallet = { writeContract: vi.fn() } as unknown as Parameters<typeof setUsername>[0];

    await expect(setUsername(wallet, 'x')).rejects.toThrow(/No wallet account/);
  });
});
