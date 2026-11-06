import { describe, expect, it } from 'vitest';
import type { EventQuery } from '../../lib/index/arkivMirror.js';
import type { StoredEvent } from '../../lib/index/mirror.js';
import { createIndexRoutes } from '../indexRoutes.js';

const A = '0x00000000000000000000000000000000000000aa';
const B = '0x00000000000000000000000000000000000000bb';
let seq = 0;
const ev = (
  kind: string,
  who: string,
  ref: string,
  data: Record<string, string> = {}
): StoredEvent => {
  const block = ++seq;
  return {
    kind,
    evt: `${String(block).padStart(13, '0')}-00000`,
    block: BigInt(block),
    ts: 1_790_000_000 + block,
    who: who as never,
    ref,
    data,
  };
};

const chainEvents: StoredEvent[] = [
  ev('ProfileCreated', A, '1', { username: 'aadhira', profileId: '1' }),
  ev('ProfileCreated', B, '2', { username: 'kavya', profileId: '2' }),
  ev('ProfileVerified', A, A),
  ev('AvatarUpdated', B, B, { cid: 'bafy-b' }),
  ev('ContributionRecorded', A, '1', { total: '2500' }),
  ev('ContributionRecorded', B, '1', { total: '5000' }),
  ev('ContributionRecorded', B, '2', { total: '77' }),
  ev('AchievementMinted', A, '0xaa'),
  ev('TerritoryClaimed', A, '0x01', {
    areaSqm: '1500',
    strength: '100',
    capturedAt: '5',
    minLng: '73850000',
    minLat: '18520000',
    maxLng: '73860000',
    maxLat: '18530000',
  }),
  ev('GroupJoined', A, '7'),
  ev('GroupJoined', B, '7'),
  ev('ActivityRecorded', A, '1', {
    activityId: '1',
    owner: A,
    activityHash: '0xh1',
    activityType: '0',
    distance: '5000',
    duration: '1680',
    timestamp: '1790000100',
    territoryArea: '0',
  }),
  ev('ActivityMetadataUpdated', A, '1', { activityId: '1', metadataCid: 'bafy-route' }),
  ev('ActivityRecorded', B, '2', {
    activityId: '2',
    owner: B,
    activityHash: '0xh2',
    activityType: '1',
    distance: '300',
    duration: '90',
    timestamp: '1790000200',
    territoryArea: '0',
  }),
];

const matching = (q: EventQuery) =>
  chainEvents.filter(
    (e) =>
      e.kind === q.kind && (!q.who || e.who === q.who) && (q.ref === undefined || e.ref === q.ref)
  );

const app = (overrides: { stale?: boolean } = {}) =>
  createIndexRoutes({
    fresh: async () => ({ syncedBlock: '321', stale: overrides.stale ?? false }),
    events: async (q) => matching(q),
  });

const get = async (path: string, routes = app()) => {
  const res = await routes.request(path);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

describe('GET /leaderboard/:seasonId', () => {
  it('lists each athlete of the season with distance, territory, achievements and verification, biggest first', async () => {
    const { status, body } = await get('/leaderboard/1');

    expect(status).toBe(200);
    expect(body.entries).toEqual([
      {
        wallet: B,
        username: 'kavya',
        isVerified: false,
        distance: 5000,
        territoryArea: 0,
        achievementCount: 0,
      },
      {
        wallet: A,
        username: 'aadhira',
        isVerified: true,
        distance: 2500,
        territoryArea: 1500,
        achievementCount: 1,
      },
    ]);
  });

  it('says how fresh the answer is', async () => {
    expect((await get('/leaderboard/1')).body).toMatchObject({ syncedBlock: '321', stale: false });
    expect((await get('/leaderboard/1', app({ stale: true }))).body).toMatchObject({ stale: true });
  });

  it('refuses a season that is not a number', async () => {
    expect((await get('/leaderboard/abc')).status).toBe(400);
  });
});

describe('GET /territories', () => {
  it('lists territories with owner, area and bounds in degrees', async () => {
    const { body } = await get('/territories');

    expect(body.territories).toEqual([
      expect.objectContaining({
        id: '0x01',
        owner: A,
        areaSqm: 1500,
        isActive: true,
        bounds: { minLng: 73.85, minLat: 18.52, maxLng: 73.86, maxLat: 18.53 },
      }),
    ]);
  });
});

describe('GET /group/:id/members', () => {
  it('lists the current members in join order', async () => {
    expect((await get('/group/7/members')).body.members).toEqual([A, B]);
  });

  it('refuses an id that is not a number', async () => {
    expect((await get('/group/x/members')).status).toBe(400);
  });
});

describe('GET /athlete/:wallet', () => {
  it('composes the profile, holdings, achievements and season distance of one athlete', async () => {
    const { status, body } = await get(`/athlete/${A}`);

    expect(status).toBe(200);
    expect(body.athlete).toMatchObject({
      wallet: A,
      profileId: '1',
      username: 'aadhira',
      isVerified: true,
      avatarCid: null,
      territories: [expect.objectContaining({ id: '0x01', areaSqm: 1500 })],
      achievements: [{ achievementId: '0xaa', mintedAt: expect.any(Number) }],
      contributions: [{ seasonId: '1', distance: 2500 }],
    });
    expect((body.athlete as { activities: unknown[] }).activities).toHaveLength(1);
  });

  it('answers 404 for a wallet with no profile', async () => {
    expect((await get('/athlete/0x00000000000000000000000000000000000000cc')).status).toBe(404);
  });

  it('refuses something that is not a wallet', async () => {
    expect((await get('/athlete/nope')).status).toBe(400);
  });
});

describe('GET /profiles', () => {
  it('lists every profile with its avatar', async () => {
    expect((await get('/profiles')).body.profiles).toEqual([
      { wallet: A, profileId: '1', username: 'aadhira', isVerified: true, avatarCid: null },
      { wallet: B, profileId: '2', username: 'kavya', isVerified: false, avatarCid: 'bafy-b' },
    ]);
  });
});

describe('GET /activities', () => {
  it('lists activities newest first, optionally for one wallet', async () => {
    expect(
      ((await get('/activities')).body.activities as Array<{ activityId: string }>).map(
        (a) => a.activityId
      )
    ).toEqual(['2', '1']);
    expect(((await get(`/activities?wallet=${A}`)).body.activities as unknown[]).length).toBe(1);
  });

  it('can be limited to activities that have a route to show, for the map', async () => {
    const { body } = await get('/activities?withRoute=1');

    expect((body.activities as Array<{ metadataCid: string }>).map((a) => a.metadataCid)).toEqual([
      'bafy-route',
    ]);
  });

  it('finds one activity by its hash, which is how a fresh save is confirmed visible', async () => {
    const { body } = await get('/activities?hash=0xh2');

    expect((body.activities as Array<{ activityId: string }>).map((a) => a.activityId)).toEqual([
      '2',
    ]);
  });
});
