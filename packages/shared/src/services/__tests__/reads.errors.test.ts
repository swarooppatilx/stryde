import { beforeEach, describe, expect, it, vi } from 'vitest';

const readContract = vi.hoisted(() => vi.fn());
const getLogs = vi.hoisted(() => vi.fn());

// The chain head sits a little past the deploy block, so a redeploy does not leave the scan with an empty range.
vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>();
  return {
    ...actual,
    getPublicClient: () => ({
      readContract,
      getLogs,
      getBlockNumber: async () => actual.getActiveConfig().deployBlock + 100n,
      chain: undefined,
    }),
  };
});
// No subgraph for this chain: the on-chain scan is the only source.
vi.mock('../subgraph', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../subgraph')>()),
  getProfilesFromSubgraph: async () => null,
  getActivitiesFromSubgraph: async () => null,
}));

const { getActiveConfig } = await import('../client');
const { getRegisteredUsers } = await import('../profile');
const { syncActivitiesFromChain, syncAllActivitiesFromChain, syncTerritoriesFromChain } =
  await import('../sync');

const WALLET = '0x00000000000000000000000000000000000000aa' as const;

beforeEach(() => {
  readContract.mockReset();
  getLogs.mockReset();
  readContract.mockRejectedValue(new Error('rpc down'));
  getLogs.mockRejectedValue(new Error('rpc down'));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// [] means "none exist"; callers act on that (clear territories, show an empty
// leaderboard), so an unreadable chain must reject rather than look empty.
describe('reads when the chain cannot be read', () => {
  it.each([
    ['registered users', () => getRegisteredUsers()],
    ["a wallet's activities", () => syncActivitiesFromChain(WALLET)],
    ['every activity', () => syncAllActivitiesFromChain()],
    ["a wallet's territories", () => syncTerritoriesFromChain(WALLET)],
  ])('%s: rejects instead of returning an empty list', async (_name, load) => {
    await expect(load()).rejects.toThrow('rpc down');
  });
});

describe('log scans', () => {
  it('start at the chain\u2019s deploy block, not block 0', async () => {
    getLogs.mockResolvedValue([]);

    await getRegisteredUsers();

    const { deployBlock } = getActiveConfig();
    expect(getLogs).toHaveBeenCalled();
    for (const [filter] of getLogs.mock.calls) expect(filter.fromBlock).toBe(deployBlock);
  });

  it('knows where Sepolia was deployed', () => {
    expect(getActiveConfig().deployBlock).toBeGreaterThan(0n);
  });
});

describe('territory sync', () => {
  it('fails as a whole when one territory cannot be read, instead of dropping it', async () => {
    const id1 = `0x${'01'.repeat(32)}`;
    const id2 = `0x${'02'.repeat(32)}`;
    readContract.mockReset();
    readContract
      .mockResolvedValueOnce([id1, id2])
      .mockResolvedValueOnce({
        controller: WALLET,
        capturedAt: 1n,
        lastReinforced: 1n,
        controlStrength: 100n,
        areaSqm: 500n,
      })
      .mockRejectedValueOnce(new Error('rpc down'));

    await expect(syncTerritoriesFromChain(WALLET)).rejects.toThrow();
  });
});
