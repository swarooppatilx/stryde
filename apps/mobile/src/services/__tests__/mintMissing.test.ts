import { describe, expect, it, vi } from 'vitest';
import { mintMissing } from '@/services/mintMissing';

describe('mintMissing', () => {
  it('reports what is already minted, then mints only the rest', async () => {
    const mint = vi.fn(async (_id: string) => {});
    const minted: string[][] = [];

    await mintMissing({
      ids: ['a', 'b', 'c'],
      getMinted: async () => new Set(['b']),
      mint,
      onMinted: (ids) => minted.push([...ids]),
      isCancelled: () => false,
    });

    expect(mint.mock.calls.map(([id]) => id)).toEqual(['a', 'c']);
    expect(minted.at(-1)?.sort()).toEqual(['a', 'b', 'c']);
  });

  it('keeps going when one mint fails', async () => {
    const mint = vi.fn(async (id: string) => {
      if (id === 'a') throw new Error('reverted');
    });
    const onMinted = vi.fn();

    await mintMissing({
      ids: ['a', 'b'],
      getMinted: async () => new Set(),
      mint,
      onMinted,
      isCancelled: () => false,
      onError: () => {},
    });

    expect(mint).toHaveBeenCalledTimes(2);
    expect([...(onMinted.mock.calls.at(-1)?.[0] ?? [])]).toEqual(['b']);
  });

  it('stops minting once cancelled', async () => {
    let cancelled = false;
    const mint = vi.fn(async () => {
      cancelled = true;
    });

    await mintMissing({
      ids: ['a', 'b', 'c'],
      getMinted: async () => new Set(),
      mint,
      onMinted: () => {},
      isCancelled: () => cancelled,
    });

    expect(mint).toHaveBeenCalledTimes(1);
  });

  it('mints nothing when the minted set cannot be read', async () => {
    const mint = vi.fn();

    await mintMissing({
      ids: ['a'],
      getMinted: async () => {
        throw new Error('rpc down');
      },
      mint,
      onMinted: () => {},
      isCancelled: () => false,
    });

    expect(mint).not.toHaveBeenCalled();
  });
});
