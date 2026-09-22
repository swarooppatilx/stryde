import { beforeEach, describe, expect, it, vi } from 'vitest';

const getEnsName = vi.hoisted(() => vi.fn());

vi.mock('viem', async (importOriginal) => ({
  ...(await importOriginal<typeof import('viem')>()),
  createPublicClient: () => ({ getEnsName, getEnsAddress: vi.fn() }),
}));

const { resolveEnsName } = await import('../ens');

describe('resolveEnsName', () => {
  beforeEach(() => getEnsName.mockReset());

  it('retries after a network error instead of remembering "no name" for minutes', async () => {
    const who = '0x00000000000000000000000000000000000000bb' as const;
    getEnsName.mockRejectedValueOnce(new Error('rpc down')).mockResolvedValueOnce('piyush.eth');

    expect(await resolveEnsName(who)).toBeNull();
    expect(await resolveEnsName(who)).toBe('piyush.eth');
  });

  it('remembers a genuine "no name" answer', async () => {
    const who = '0x00000000000000000000000000000000000000cc' as const;
    getEnsName.mockResolvedValue(null);

    await resolveEnsName(who);
    await resolveEnsName(who);

    expect(getEnsName).toHaveBeenCalledTimes(1);
  });
});
