import { describe, expect, it, vi } from 'vitest';
import { runChainAction } from '@/services/chainAction';

const WALLET = { account: { address: '0xaa' } } as never;
const ADDRESS = '0x00000000000000000000000000000000000000aa' as const;

describe('runChainAction', () => {
  it('tells the user instead of doing nothing when the wallet is not connected', async () => {
    const write = vi.fn();
    const notifyNoWallet = vi.fn();

    const result = await runChainAction(
      { wallet: null, address: null, transact: vi.fn(), notifyNoWallet },
      write
    );

    expect(result).toBeNull();
    expect(write).not.toHaveBeenCalled();
    expect(notifyNoWallet).toHaveBeenCalledOnce();
  });

  it('runs the write through the transactor with the connected wallet', async () => {
    const seenLabels: unknown[] = [];
    const transact = async <T>(fn: () => Promise<T>, labels?: unknown) => {
      seenLabels.push(labels);
      return fn();
    };
    const write = vi.fn(async () => ({ confirmed: true }));

    const result = await runChainAction(
      { wallet: WALLET, address: ADDRESS, transact, notifyNoWallet: vi.fn() },
      write,
      { pending: 'Saving…' }
    );

    expect(result).toEqual({ confirmed: true });
    expect(write).toHaveBeenCalledWith(WALLET, ADDRESS);
    expect(seenLabels).toEqual([{ pending: 'Saving…' }]);
  });
});
