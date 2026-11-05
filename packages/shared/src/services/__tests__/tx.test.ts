import { beforeEach, describe, expect, it, vi } from 'vitest';

const waitForTransactionReceipt = vi.hoisted(() => vi.fn());

vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client')>()),
  getPublicClient: () => ({ waitForTransactionReceipt }),
}));

const { writeAndConfirm } = await import('../tx');
const { getContracts, getActiveConfig } = await import('../client');

const ACCOUNT = { address: '0x00000000000000000000000000000000000000aa', type: 'smart' };
const HASH = `0x${'11'.repeat(32)}` as const;

function walletWith(account: unknown = ACCOUNT) {
  const writeContract = vi.fn().mockResolvedValue(HASH);
  return { wallet: { account, writeContract } as never, writeContract };
}

beforeEach(() => {
  waitForTransactionReceipt.mockReset();
  waitForTransactionReceipt.mockResolvedValue({ status: 'success', logs: [] });
});

describe('writeAndConfirm', () => {
  it('sends to the named contract with the wallet account object and the active chain', async () => {
    const { wallet, writeContract } = walletWith();

    await writeAndConfirm(wallet, 'profileRegistry', {
      functionName: 'setAvatar',
      args: ['bafy'],
    });

    expect(writeContract).toHaveBeenCalledWith({
      address: getContracts().profileRegistry.address,
      abi: getContracts().profileRegistry.abi,
      functionName: 'setAvatar',
      args: ['bafy'],
      account: ACCOUNT,
      chain: getActiveConfig().chain,
    });
  });

  it('passes the ETH value along for payable calls', async () => {
    const { wallet, writeContract } = walletWith();

    await writeAndConfirm(wallet, 'challengeRegistry', {
      functionName: 'acceptChallenge',
      args: [1n],
      value: 10n,
    });

    expect(writeContract).toHaveBeenCalledWith(expect.objectContaining({ value: 10n }));
  });

  it('returns the hash, whether it confirmed, and the receipt', async () => {
    const { wallet } = walletWith();

    const result = await writeAndConfirm(wallet, 'profileRegistry', {
      functionName: 'setAvatar',
      args: ['x'],
    });

    expect(result).toEqual({
      txHash: HASH,
      confirmed: true,
      receipt: { status: 'success', logs: [] },
    });
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({ hash: HASH });
  });

  it('reports a reverted transaction as not confirmed', async () => {
    waitForTransactionReceipt.mockResolvedValue({ status: 'reverted', logs: [] });
    const { wallet } = walletWith();

    const result = await writeAndConfirm(wallet, 'profileRegistry', {
      functionName: 'setAvatar',
      args: ['x'],
    });

    expect(result.confirmed).toBe(false);
  });

  it('refuses a wallet that has no account', async () => {
    const { wallet, writeContract } = walletWith(null);

    await expect(
      writeAndConfirm(wallet, 'profileRegistry', { functionName: 'setAvatar', args: ['x'] })
    ).rejects.toThrow(/No wallet account/);
    expect(writeContract).not.toHaveBeenCalled();
  });
});
