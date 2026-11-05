import { afterEach, describe, expect, it, vi } from 'vitest';

let subgraphUrl: string | undefined = 'https://graph.test/q';
vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>();
  return { ...actual, getActiveConfig: () => ({ subgraphUrl }) };
});

const { getLeaderboardFromSubgraph } = await import('../subgraphSeason');
const { getUserStreakFromSubgraph } = await import('../subgraphStats');

const WALLET = '0x00000000000000000000000000000000000000AA' as const;

function reply(data: unknown) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data }) }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const participant = (
  id: string,
  distance: number,
  { verified = false, areas = [] as number[], achievements = 0 } = {}
) => ({
  totalContribution: String(distance),
  user: {
    id,
    username: id,
    isVerified: verified,
    territories: areas.map((a) => ({ area: String(a) })),
    achievements: Array.from({ length: achievements }, (_, i) => ({ id: `${id}-${i}` })),
  },
});

afterEach(() => {
  vi.unstubAllGlobals();
  subgraphUrl = 'https://graph.test/q';
});

describe('getLeaderboardFromSubgraph', () => {
  it('has no answer without a subgraph, so callers fall back to the chain', async () => {
    subgraphUrl = undefined;

    expect(await getLeaderboardFromSubgraph(1n)).toBeNull();
  });

  it('scores distance plus territory and achievements, so ground and badges can outrank mileage', async () => {
    reply({
      seasonParticipants: [
        participant('runner', 10_000),
        participant('conqueror', 4_000, { areas: [60_000, 40_000], achievements: 3 }),
      ],
    });

    const board = await getLeaderboardFromSubgraph(1n);

    // conqueror: 4000 + 100000 * 0.05 + 3 * 500 = 10500 beats runner's 10000
    expect(board?.map((e) => e.wallet)).toEqual(['conqueror', 'runner']);
    expect(board?.[0]).toMatchObject({
      distance: 4_000,
      territoryArea: 100_000,
      achievementCount: 3,
    });
    expect(board?.[0]?.score).toBeCloseTo(10_500);
  });

  it('gives verified humans a 10% bonus', async () => {
    reply({
      seasonParticipants: [
        participant('anon', 1_000),
        participant('human', 1_000, { verified: true }),
      ],
    });

    const board = await getLeaderboardFromSubgraph(1n);

    expect(board?.map((e) => e.wallet)).toEqual(['human', 'anon']);
    expect(board?.[0]?.score).toBeCloseTo(1_100);
  });

  it('asks for the requested season', async () => {
    const fetchMock = reply({ seasonParticipants: [] });

    await getLeaderboardFromSubgraph(7n);

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body
    );
    expect(body.variables).toEqual({ seasonId: '7' });
  });
});

describe('getUserStreakFromSubgraph', () => {
  it('turns the indexed strings into numbers', async () => {
    reply({
      userStreak: {
        user: { id: WALLET, username: 'asha' },
        currentStreak: '4',
        longestStreak: '9',
        lastActiveDay: '20000',
        totalActiveDays: '31',
      },
    });

    expect(await getUserStreakFromSubgraph(WALLET)).toEqual({
      wallet: WALLET,
      username: 'asha',
      currentStreak: 4,
      longestStreak: 9,
      lastActiveDay: 20000,
      totalActiveDays: 31,
    });
  });

  it('is null for someone with no streak yet, and when there is no subgraph', async () => {
    reply({ userStreak: null });
    expect(await getUserStreakFromSubgraph(WALLET)).toBeNull();

    subgraphUrl = undefined;
    expect(await getUserStreakFromSubgraph(WALLET)).toBeNull();
  });

  it('looks the wallet up in lower case, as the subgraph stores it', async () => {
    const fetchMock = reply({ userStreak: null });

    await getUserStreakFromSubgraph(WALLET);

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body
    );
    expect(body.variables).toEqual({ wallet: WALLET.toLowerCase() });
  });
});
