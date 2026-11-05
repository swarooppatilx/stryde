import { beforeEach, describe, expect, it, vi } from 'vitest';

const readContract = vi.hoisted(() => vi.fn());

vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client')>()),
  getPublicClient: () => ({ readContract }),
}));

const { syncProfileFromChain } = await import('../sync');

const WALLET = '0x00000000000000000000000000000000000000aa' as const;

beforeEach(() => {
  readContract.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('syncProfileFromChain', () => {
  it('says "not registered" without an error when the wallet has no profile', async () => {
    readContract.mockResolvedValueOnce(false);

    expect(await syncProfileFromChain(WALLET)).toEqual({ isRegistered: false, profileId: null });
    expect(console.warn).not.toHaveBeenCalled();
    expect(readContract).toHaveBeenCalledTimes(1);
  });

  it('returns the profile id for a registered wallet', async () => {
    readContract.mockResolvedValueOnce(true).mockResolvedValueOnce(7n);

    expect(await syncProfileFromChain(WALLET)).toEqual({ isRegistered: true, profileId: 7n });
  });

  it('does not mistake a network failure for "not registered"', async () => {
    readContract.mockRejectedValueOnce(new Error('rpc timeout'));

    await expect(syncProfileFromChain(WALLET)).rejects.toThrow('rpc timeout');
  });
});
