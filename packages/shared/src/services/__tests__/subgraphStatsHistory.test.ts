import { afterEach, describe, expect, it, vi } from 'vitest';

let subgraphUrl: string | undefined = 'https://graph.test/q';
vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>();
  return { ...actual, getActiveConfig: () => ({ subgraphUrl }) };
});

const { getLeaderboardSnapshotFromSubgraph, getTerritoryHistoryFromSubgraph } = await import(
  '../subgraphStats'
);

function reply(data: unknown) {
  const fetchMock = vi.fn(async (_url: string, _init: { body: string }) => ({
    ok: true,
    json: async () => ({ data }),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const sentVariables = (fetchMock: ReturnType<typeof reply>) =>
  JSON.parse(fetchMock.mock.calls[0]?.[1].body ?? '{}').variables;

afterEach(() => {
  vi.unstubAllGlobals();
  subgraphUrl = 'https://graph.test/q';
});

describe('getLeaderboardSnapshotFromSubgraph', () => {
  it('has no answer without a subgraph', async () => {
    subgraphUrl = undefined;

    expect(await getLeaderboardSnapshotFromSubgraph(1n)).toBeNull();
  });

  it('ranks the rows in the order the subgraph returns them, starting at 1', async () => {
    const fetchMock = reply({
      leaderboardSnapshots: [
        {
          id: 's1',
          user: { id: '0xaa', username: 'asha', isVerified: true },
          totalDistance: '9000',
          lastContribution: '50',
          computedAt: '60',
        },
        {
          id: 's2',
          user: { id: '0xbb', username: 'dev', isVerified: false },
          totalDistance: '4000',
          lastContribution: '40',
          computedAt: '60',
        },
      ],
    });

    const rows = await getLeaderboardSnapshotFromSubgraph(3n);

    expect(rows?.map((r) => [r.rank, r.username, r.totalDistance])).toEqual([
      [1, 'asha', 9000],
      [2, 'dev', 4000],
    ]);
    expect(rows?.[0]).toMatchObject({ isVerified: true, lastContribution: 50, computedAt: 60 });
    expect(sentVariables(fetchMock)).toEqual({ seasonId: '3' });
  });
});

describe('getTerritoryHistoryFromSubgraph', () => {
  it('has no answer without a subgraph', async () => {
    subgraphUrl = undefined;

    expect(await getTerritoryHistoryFromSubgraph('0xAB' as `0x${string}`)).toBeNull();
  });

  it('turns each strength change into numbers, and looks the territory up in lower case', async () => {
    const fetchMock = reply({
      territoryStrengthHistories: [
        {
          id: 'h1',
          territory: { id: '0xab', owner: { id: '0xaa' } },
          strength: '3',
          changeType: 'REINFORCED',
          blockNumber: '120',
          timestamp: '1700000000',
        },
      ],
    });

    const history = await getTerritoryHistoryFromSubgraph('0xAB' as `0x${string}`);

    expect(history).toEqual([
      {
        territoryId: '0xab',
        owner: '0xaa',
        strength: 3,
        changeType: 'REINFORCED',
        blockNumber: 120,
        timestamp: 1_700_000_000,
      },
    ]);
    expect(sentVariables(fetchMock)).toEqual({ territoryId: '0xab', first: 100 });
  });

  it('asks for as many changes as the caller wants', async () => {
    const fetchMock = reply({ territoryStrengthHistories: [] });

    await getTerritoryHistoryFromSubgraph('0xab' as `0x${string}`, 10);

    expect(sentVariables(fetchMock).first).toBe(10);
  });
});
