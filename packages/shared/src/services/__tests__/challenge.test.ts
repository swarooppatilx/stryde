import { beforeEach, describe, expect, it, vi } from 'vitest';

const syncActivitiesFromChain = vi.hoisted(() => vi.fn());
const readContract = vi.hoisted(() => vi.fn());
const relaySettleChallenge = vi.hoisted(() => vi.fn());

// The chain head sits a little past the deploy block, so a redeploy does not leave the scan with an empty range.
vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>();
  return {
    ...actual,
    getPublicClient: () => ({
      getBlockNumber: async () => actual.getActiveConfig().deployBlock + 100n,
      getLogs: async () => [{ blockNumber: 1n }],
      getBlock: async () => ({ timestamp: 1000n }),
      readContract,
    }),
  };
});
vi.mock('../relay', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../relay')>()),
  relaySettleChallenge,
}));
vi.mock('../sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sync')>()),
  syncActivitiesFromChain,
}));

const { determineWinner, getChallenge, getChallengeStandings, getUserChallenges, settleChallenge } =
  await import('../challenge');

const A = '0x00000000000000000000000000000000000000aa' as const;
const B = '0x00000000000000000000000000000000000000bb' as const;
const ZERO = '0x0000000000000000000000000000000000000000' as const;

/** What ChallengeRegistry.getChallenge returns for an id it never issued. */
const zeroed = {
  challenger: ZERO,
  opponent: ZERO,
  stake: 0n,
  activityType: 0,
  targetMetric: 0n,
  deadline: 0n,
  winner: ZERO,
  status: 0,
};

const created = {
  challenger: A,
  opponent: B,
  stake: 10n ** 16n,
  activityType: 0,
  targetMetric: 5000n,
  deadline: 2000n,
  winner: ZERO,
  status: 0,
};

const challenge = (activityType: number) => ({
  id: BigInt((Math.random() * 1e9) | 0),
  challenger: A,
  opponent: B,
  stake: 1n,
  activityType,
  targetMetric: 0n,
  deadline: 2000,
  winner: '0x0000000000000000000000000000000000000000' as const,
  status: 1 as never,
});

const act = (activityType: string, distance: number, timestamp = 1500) => ({
  activityType,
  distance,
  timestamp,
});

beforeEach(() => {
  syncActivitiesFromChain.mockReset();
  readContract.mockReset();
});

describe('determineWinner', () => {
  it('counts only the challenge’s sport', async () => {
    syncActivitiesFromChain.mockImplementation(async (who: string) =>
      who === A ? [act('run', 3000), act('ride', 50_000)] : [act('run', 5000)]
    );

    expect(await determineWinner(challenge(0))).toBe(B);
  });

  it('ignores activities outside the challenge window', async () => {
    syncActivitiesFromChain.mockImplementation(async (who: string) =>
      who === A ? [act('run', 9000, 999), act('run', 9000, 2001)] : [act('run', 100)]
    );

    expect(await determineWinner(challenge(0))).toBe(B);
  });
});

describe('getChallengeStandings', () => {
  it('totals each side’s distance in the challenge sport and window, so progress can be shown live', async () => {
    syncActivitiesFromChain.mockImplementation(async (who: string) =>
      who === A
        ? [act('run', 1200), act('run', 800), act('ride', 9000), act('run', 500, 3000)]
        : [act('run', 1500), act('run', 700, 10)]
    );

    expect(await getChallengeStandings(challenge(0))).toEqual({ challenger: 2000, opponent: 1500 });
  });
});

describe('getChallenge', () => {
  it('returns null for an id the registry answers with a zeroed struct', async () => {
    readContract.mockResolvedValue(zeroed);

    expect(await getChallenge(999n)).toBeNull();
  });

  it('maps a challenge the registry actually has', async () => {
    readContract.mockResolvedValue(created);

    expect(await getChallenge(1n)).toMatchObject({
      id: 1n,
      challenger: A,
      opponent: B,
      stake: 10n ** 16n,
      targetMetric: 5000n,
      deadline: 2000,
      status: 0,
    });
  });
});

describe('getUserChallenges', () => {
  it('drops a zeroed entry instead of listing a phantom challenge', async () => {
    readContract.mockImplementation(
      async ({ functionName, args }: { functionName: string; args: unknown[] }) => {
        if (functionName === 'getUserChallenges') return [7n, 8n];
        return String(args[0]) === '7' ? created : zeroed;
      }
    );

    const listed = await getUserChallenges(A);

    expect(listed.map((c) => c.id)).toEqual([7n]);
  });
});

describe('settleChallenge', () => {
  it('asks the relayer to settle, which is the only account the contract accepts', async () => {
    relaySettleChallenge.mockResolvedValue({ confirmed: true, hash: '0xabc' });

    const result = await settleChallenge(7n);

    expect(relaySettleChallenge).toHaveBeenCalledWith(7n);
    expect(result).toEqual({ confirmed: true, txHash: '0xabc' });
  });

  it('reports an unconfirmed or queued settlement as not settled yet', async () => {
    relaySettleChallenge.mockResolvedValue({ confirmed: false, queued: true });

    expect(await settleChallenge(7n)).toEqual({ confirmed: false, txHash: undefined });
  });
});
