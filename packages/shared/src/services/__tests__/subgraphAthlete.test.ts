import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let subgraphUrl: string | undefined = 'https://graph.test/q';

vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>();
  return { ...actual, getActiveConfig: () => ({ subgraphUrl }) };
});

const { getAthleteComposite } = await import('../subgraph');

const WALLET = '0x00000000000000000000000000000000000000AA';

const profile = {
  id: WALLET.toLowerCase(),
  username: 'asha_runs',
  profileId: '7',
  avatarCid: null,
  isVerified: true,
  verifiedAt: '1700000000',
  activities: [
    {
      activityId: '3',
      activityHash: '0xabc',
      activityType: 1,
      distance: '5000',
      duration: '1800000',
      territoryArea: '250',
      timestamp: '1700000100',
      metadataCid: null,
    },
  ],
  territories: [
    {
      id: 't1',
      area: '900',
      strength: '2',
      isActive: true,
      capturedAt: '10',
      lastReinforced: '20',
      minLng: 73_800_000,
      minLat: 18_500_000,
      maxLng: 73_900_000,
      maxLat: 18_600_000,
    },
  ],
  contributions: [
    { distance: '5000', season: { id: '1', isActive: true, totalContributions: '9' } },
  ],
  achievements: [
    { id: 'a1', achievementId: '1', mintedAt: '30', definition: { name: 'First Run' } },
    { id: 'a2', achievementId: '2', mintedAt: '40', definition: null },
  ],
};

let sent: { query: string; variables: Record<string, unknown> }[];
let data: unknown;

beforeEach(() => {
  subgraphUrl = 'https://graph.test/q';
  sent = [];
  data = { profile };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ data }) };
    })
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('getAthleteComposite', () => {
  it('refuses anything that is not a wallet address before sending a query', async () => {
    await expect(getAthleteComposite('0x123' as `0x${string}`)).rejects.toThrow(/Invalid wallet/);
    expect(sent).toHaveLength(0);
  });

  it('has nothing to say without a subgraph', async () => {
    subgraphUrl = undefined;

    expect(await getAthleteComposite(WALLET as `0x${string}`)).toBeNull();
  });

  it('asks by lower-cased wallet and is null for a wallet with no profile yet', async () => {
    data = { profile: null };

    expect(await getAthleteComposite(WALLET as `0x${string}`)).toBeNull();
    expect(sent[0]?.variables.id).toBe(WALLET.toLowerCase());
  });

  it('reads the identity, verification and activities', async () => {
    const athlete = await getAthleteComposite(WALLET as `0x${string}`);

    expect(athlete).toMatchObject({
      wallet: WALLET.toLowerCase(),
      username: 'asha_runs',
      profileId: 7n,
      avatarCid: undefined,
      isVerified: true,
      verifiedAt: 1_700_000_000,
    });
    expect(athlete?.activities[0]).toMatchObject({
      activityId: 3n,
      owner: WALLET.toLowerCase(),
      distance: 5000,
      duration: 1_800_000,
      territoryArea: 250,
    });
  });

  it('reads territories with their bounds in degrees, and the season contributions', async () => {
    const athlete = await getAthleteComposite(WALLET as `0x${string}`);

    expect(athlete?.territories[0]).toMatchObject({ id: 't1', areaSqm: 900, isActive: true });
    expect(athlete?.territories[0]?.bounds?.minLng).toBeCloseTo(73.8, 5);
    expect(athlete?.territories[0]?.bounds?.maxLat).toBeCloseTo(18.6, 5);
    expect(athlete?.contributions).toEqual([
      { distance: 5000, seasonId: '1', seasonActive: true, seasonTotalContributions: 9 },
    ]);
  });

  it('reads achievements, with a name only where the definition has one', async () => {
    const athlete = await getAthleteComposite(WALLET as `0x${string}`);

    expect(athlete?.achievements.map((a) => a.name)).toEqual(['First Run', undefined]);
  });
});
