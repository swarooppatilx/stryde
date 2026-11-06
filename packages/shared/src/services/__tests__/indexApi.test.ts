import { afterEach, describe, expect, it, vi } from 'vitest';
import { setIpfsConfig } from '../ipfs';

// No subgraph on this chain: these are the reads that used to answer null or empty.
vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>();
  return { ...actual, getActiveConfig: () => ({ ...actual.getActiveConfig(), subgraphUrl: '' }) };
});

const { getAthleteComposite } = await import('../subgraphAthlete');
const { getGroupMembersFromSubgraph } = await import('../subgraphGroup');
const { getLeaderboardFromSubgraph, weightedScore } = await import('../subgraphSeason');
const { getActivityRoutesFromSubgraph, getTerritoriesFromSubgraph } = await import(
  '../subgraphTerritory'
);

const A = '0x00000000000000000000000000000000000000aa';
const B = '0x00000000000000000000000000000000000000bb';

/** Points the shared services at a fake API that answers each path with the given body. */
function api(answers: Record<string, { status?: number; body: unknown }>) {
  const calls: string[] = [];
  setIpfsConfig({
    apiUrl: 'http://api.test',
    apiKey: 'k',
    fetch: (async (url: string) => {
      const parsed = new URL(url);
      const path = (parsed.pathname + parsed.search).replace('/api/index/', '');
      calls.push(path);
      const answer = answers[path];
      if (!answer) return new Response(JSON.stringify({ error: 'nope' }), { status: 404 });
      return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
    }) as typeof fetch,
  });
  return calls;
}

afterEach(() => {
  setIpfsConfig(undefined as never);
  vi.restoreAllMocks();
});

describe('club members from the Arkiv index', () => {
  it('lists the wallets the index reports', async () => {
    api({ 'group/7/members': { body: { members: [A, B], syncedBlock: '1', stale: false } } });

    expect(await getGroupMembersFromSubgraph(7n)).toEqual([A, B]);
  });

  it('stays unavailable (null) when the index cannot be reached, rather than showing an empty club', async () => {
    api({ 'group/7/members': { status: 503, body: { error: 'down' } } });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await getGroupMembersFromSubgraph(7n)).toBeNull();
  });

  it('stays unavailable when the app has no API configured at all', async () => {
    expect(await getGroupMembersFromSubgraph(7n)).toBeNull();
  });
});

describe('territories from the Arkiv index', () => {
  const row = {
    id: '0x01',
    owner: A,
    areaSqm: 1500,
    strength: 100,
    capturedAt: 5,
    lastReinforced: 6,
    isActive: true,
    bounds: { minLng: 73.85, minLat: 18.52, maxLng: 73.86, maxLat: 18.53 },
  };

  it('returns the active territories as the map expects them', async () => {
    api({
      territories: {
        body: {
          territories: [row, { ...row, id: '0x02', isActive: false }],
          syncedBlock: '1',
          stale: false,
        },
      },
    });

    expect(await getTerritoriesFromSubgraph()).toEqual([row]);
  });

  it('is null when the index is unreachable, so the map knows it could not read rather than that nobody owns ground', async () => {
    api({ territories: { status: 503, body: {} } });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await getTerritoriesFromSubgraph()).toBeNull();
  });
});

describe('other athletes’ routes from the Arkiv index', () => {
  it('returns activities that have a route, newest first, with the sport named', async () => {
    const calls = api({
      'activities?withRoute=1&limit=50': {
        body: {
          activities: [
            {
              activityId: '9',
              user: A,
              activityHash: '0xh',
              activityType: 1,
              distance: 300,
              duration: 90,
              timestamp: 1790000200,
              territoryArea: 0,
              metadataCid: 'bafy',
            },
          ],
          syncedBlock: '1',
          stale: false,
        },
      },
    });

    expect(await getActivityRoutesFromSubgraph(50)).toEqual([
      {
        wallet: A,
        activityId: 9n,
        activityType: 'ride',
        distance: 300,
        timestamp: 1790000200,
        metadataCid: 'bafy',
      },
    ]);
    expect(calls).toEqual(['activities?withRoute=1&limit=50']);
  });
});

describe('leaderboard from the Arkiv index', () => {
  it('scores each athlete with the app’s own weights and ranks by that score', async () => {
    api({
      'leaderboard/1': {
        body: {
          entries: [
            {
              wallet: A,
              username: 'a',
              isVerified: false,
              distance: 5000,
              territoryArea: 0,
              achievementCount: 0,
            },
            {
              wallet: B,
              username: 'b',
              isVerified: true,
              distance: 4000,
              territoryArea: 20000,
              achievementCount: 2,
            },
          ],
          syncedBlock: '1',
          stale: false,
        },
      },
    });

    const board = await getLeaderboardFromSubgraph(1n);

    expect(board?.map((e) => e.wallet)).toEqual([B, A]);
    expect(board?.[0]?.score).toBe(
      weightedScore({ distance: 4000, territoryArea: 20000, achievementCount: 2, isVerified: true })
    );
    expect(board?.[1]?.score).toBe(5000);
  });

  it('weights territory, achievements and verification as the subgraph path always did', () => {
    expect(
      weightedScore({ distance: 1000, territoryArea: 2000, achievementCount: 1, isVerified: false })
    ).toBe(1000 + 2000 * 0.05 + 500);
    expect(
      weightedScore({ distance: 1000, territoryArea: 0, achievementCount: 0, isVerified: true })
    ).toBeCloseTo(1100);
  });

  it('is null when the index is unreachable, so the caller falls back to the distance-only chain read', async () => {
    api({ 'leaderboard/1': { status: 503, body: {} } });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await getLeaderboardFromSubgraph(1n)).toBeNull();
  });
});

describe('athlete composite from the Arkiv index', () => {
  it('fills the header details (verified, territory, achievements) that were blank', async () => {
    api({
      [`athlete/${A}`]: {
        body: {
          athlete: {
            wallet: A,
            profileId: '1',
            username: 'aadhira',
            isVerified: true,
            avatarCid: 'bafy-a',
            activities: [
              {
                activityId: '1',
                user: A,
                activityHash: '0xh1',
                activityType: 0,
                distance: 5000,
                duration: 1680,
                timestamp: 100,
                territoryArea: 0,
                metadataCid: null,
              },
            ],
            territories: [
              {
                id: '0x01',
                owner: A,
                areaSqm: 1500,
                strength: 100,
                capturedAt: 5,
                lastReinforced: 6,
                isActive: true,
                bounds: { minLng: 1, minLat: 2, maxLng: 3, maxLat: 4 },
              },
            ],
            achievements: [{ achievementId: '0xaa', mintedAt: 50 }],
            contributions: [{ seasonId: '1', distance: 2500 }],
          },
          syncedBlock: '1',
          stale: false,
        },
      },
    });

    const composite = await getAthleteComposite(A);

    expect(composite).toMatchObject({
      wallet: A,
      profileId: 1n,
      username: 'aadhira',
      isVerified: true,
      avatarCid: 'bafy-a',
      territories: [{ id: '0x01', areaSqm: 1500, isActive: true }],
      achievements: [{ achievementId: '0xaa', mintedAt: 50 }],
      contributions: [{ seasonId: '1', distance: 2500 }],
    });
    expect(composite?.activities[0]).toMatchObject({
      activityId: 1n,
      owner: A,
      activityType: 'run',
      distance: 5000,
    });
  });

  it('is null for a wallet the index has no profile for, so the per-registry sync path takes over', async () => {
    api({ [`athlete/${A}`]: { status: 404, body: { error: 'No profile for this wallet' } } });

    expect(await getAthleteComposite(A)).toBeNull();
  });
});
