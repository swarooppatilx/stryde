import { beforeEach, describe, expect, it, vi } from 'vitest';

const readContract = vi.hoisted(() => vi.fn());
const relayStartSeason = vi.hoisted(() => vi.fn());

vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>();
  return { ...actual, getPublicClient: () => ({ readContract }) };
});
vi.mock('../relay', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../relay')>()),
  relayStartSeason,
}));

const { setChainMode } = await import('../client');
const { getParticipantContribution, invalidateSeasonCaches, ensureActiveSeason } = await import(
  '../season'
);

const ME = '0x00000000000000000000000000000000000000aa' as const;

beforeEach(() => {
  invalidateSeasonCaches();
  readContract.mockReset();
  relayStartSeason.mockReset();
});

describe('season caches', () => {
  it('does not show one network’s contribution after switching to another', async () => {
    readContract.mockResolvedValueOnce(100n).mockResolvedValueOnce(5n);

    setChainMode('ethereum-sepolia');
    expect(await getParticipantContribution(1n, ME)).toBe(100n);
    setChainMode('local');
    expect(await getParticipantContribution(1n, ME)).toBe(5n);
  });
});

describe('ensureActiveSeason on a live network', () => {
  const rawSeason = (isActive: boolean) => ({
    id: 1n,
    startTime: 0n,
    endTime: 10n,
    totalContributions: 0n,
    isActive,
  });

  it('fails loudly when the relayer did not start the season', async () => {
    setChainMode('ethereum-sepolia');
    readContract.mockResolvedValue(rawSeason(false));
    relayStartSeason.mockResolvedValue({ confirmed: false, queued: true });

    await expect(ensureActiveSeason({} as never)).rejects.toThrow(/season/i);
  });
});
