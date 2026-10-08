import { afterEach, describe, expect, it } from 'vitest';
import { readBalances, setBalanceReader } from '@/backends/balanceSource';

afterEach(() => setBalanceReader(null));

const address = '0x00000000000000000000000000000000000000aa' as const;

describe('balance source', () => {
  it('reads through whatever reader a profile registered', async () => {
    setBalanceReader(async () => ({ eth: 7n, strd: 9n }));

    expect(await readBalances(address)).toEqual({ eth: 7n, strd: 9n });
  });

  it('hands the address to the reader', async () => {
    let seen: string | null = null;
    setBalanceReader(async (target) => {
      seen = target;
      return { eth: null, strd: null };
    });

    await readBalances(address);

    expect(seen).toBe(address);
  });

  it('passes a reader that has nothing through as nulls, so the screen can hide the figure', async () => {
    setBalanceReader(async () => ({ eth: null, strd: null }));

    expect(await readBalances(address)).toEqual({ eth: null, strd: null });
  });
});
