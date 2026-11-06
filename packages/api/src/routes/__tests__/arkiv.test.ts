import { beforeEach, describe, expect, it, vi } from 'vitest';

const ATHLETE = '0x00000000000000000000000000000000000000aa';
const OTHER = '0x00000000000000000000000000000000000000bb';
const ARCHIVE_KEY = `0x${'1'.repeat(64)}`;
const EFFORT_KEY = `0x${'2'.repeat(64)}`;
const PLAIN_REF = 'a'.repeat(64);
const SEALED_REF = 'enc:v1:sealed';

const fitness = vi.hoisted(() => ({
  isArkivConfigured: vi.fn(() => true),
  createRouteArchive: vi.fn(),
  getRouteArchive: vi.fn(),
  athleteRouteArchives: vi.fn(),
  getEffort: vi.fn(),
  findSegmentsNear: vi.fn(async () => []),
  createEffort: vi.fn(),
  getArkivWriter: vi.fn(() => '0x00000000000000000000000000000000000000ff'),
  upsertBeacon: vi.fn(),
}));
const swarm = vi.hoisted(() => ({
  isSwarmConfigured: vi.fn(() => true),
  uploadToSwarm: vi.fn(),
  downloadFromSwarm: vi.fn(async () => '<gpx/>'),
  sealReference: vi.fn(() => SEALED_REF),
  openReference: vi.fn(() => 'b'.repeat(128)),
  isSealedReference: vi.fn((ref: string) => ref.startsWith('enc:v1:')),
  swarmGatewayLink: vi.fn((ref: string) => `https://gateway.test/bytes/${ref}`),
}));
const human = vi.hoisted(() => ({
  isWalletBanned: vi.fn(() => false),
  resolveHumanSession: vi.fn((): string | null => null),
}));

vi.mock('../../lib/arkivFitness.js', () => fitness);
vi.mock('../../lib/swarm.js', () => swarm);
vi.mock('../../lib/humanPass.js', () => human);
vi.mock('../../lib/store.js', () => ({
  store: { findLinkByWallet: vi.fn(() => undefined), listBannedWallets: vi.fn(() => []) },
}));
vi.mock('../../lib/relayer.js', () => ({
  getRelayerPublicClient: () => ({ readContract: async () => ({ id: 3n, isActive: true }) }),
}));
vi.mock('../../lib/chainConfig.js', () => ({
  getRelayChainConfig: () => ({}),
  contractAddress: () => '0x0000000000000000000000000000000000000001',
}));

const { arkiv } = await import('../arkiv.js');

function archive(overrides: Record<string, unknown> = {}) {
  return {
    key: ARCHIVE_KEY,
    athlete: ATHLETE,
    activityId: 7,
    recordedAt: 1_700_000_000_000,
    swarmRef: PLAIN_REF,
    encrypted: false,
    distanceM: 5000,
    pointCount: 2,
    contentType: 'application/gpx+xml',
    owner: ATHLETE,
    expiresAt: null,
    ...overrides,
  };
}

function match(privateRoute: boolean) {
  return arkiv.request('/activities/match', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      athlete: ATHLETE,
      activityId: 7,
      name: 'Morning run',
      distanceM: 5000,
      privateRoute,
      track: [
        { latitude: 19.07, longitude: 72.87, timestamp: 1_700_000_000_000 },
        { latitude: 19.08, longitude: 72.88, timestamp: 1_700_000_600_000 },
      ],
    }),
  });
}

const authed = { headers: { authorization: 'Bearer stryde_human_test' } };

describe('arkiv route archives', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    human.resolveHumanSession.mockReturnValue(null);
    swarm.uploadToSwarm.mockResolvedValue(PLAIN_REF);
    fitness.createRouteArchive.mockResolvedValue({ key: ARCHIVE_KEY, txHash: '0xtx' });
  });

  it('writes one archive entity per run holding the plain reference for a public route', async () => {
    const res = await match(false);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.archiveKey).toBe(ARCHIVE_KEY);
    expect(body.swarmLink).toBe(`https://gateway.test/bytes/${PLAIN_REF}`);
    expect(fitness.createRouteArchive).toHaveBeenCalledWith(
      expect.objectContaining({ athlete: ATHLETE, swarmRef: PLAIN_REF, encrypted: false })
    );
  });

  it('never writes an encrypted reference as-is: private routes store it sealed', async () => {
    const res = await match(true);
    const body = await res.json();
    expect(swarm.uploadToSwarm).toHaveBeenCalledWith(expect.any(String), {
      encrypt: true,
      name: expect.stringMatching(/^stryde-run-\d{12}\.gpx$/),
    });
    expect(fitness.createRouteArchive).toHaveBeenCalledWith(
      expect.objectContaining({ swarmRef: SEALED_REF, encrypted: true })
    );
    expect(body.swarmLink).toBeNull();
  });

  it('still answers when the archive entity cannot be written', async () => {
    fitness.createRouteArchive.mockRejectedValue(new Error('429'));
    const body = await (await match(false)).json();
    expect(body.archiveKey).toBeNull();
    expect(body.swarmRef).toBe(PLAIN_REF);
  });

  it('hides the reference of a private archive in its public view', async () => {
    fitness.getRouteArchive.mockResolvedValue(archive({ swarmRef: SEALED_REF, encrypted: true }));
    const body = await (await arkiv.request(`/archives/${ARCHIVE_KEY}`)).json();
    expect(body.swarmRef).toBeNull();
    expect(body.swarmLink).toBeNull();
    expect(body.explorer).toContain(ARCHIVE_KEY);
  });

  it('serves a public route to anyone', async () => {
    fitness.getRouteArchive.mockResolvedValue(archive());
    const res = await arkiv.request(`/archives/${ARCHIVE_KEY}/gpx`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<gpx/>');
    expect(swarm.downloadFromSwarm).toHaveBeenCalledWith(PLAIN_REF);
  });

  it('asks for a wallet session before opening a private route', async () => {
    fitness.getRouteArchive.mockResolvedValue(archive({ swarmRef: SEALED_REF, encrypted: true }));
    const res = await arkiv.request(`/archives/${ARCHIVE_KEY}/gpx`);
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('session_required');
    expect(swarm.openReference).not.toHaveBeenCalled();
  });

  it('refuses a private route to a signed-in wallet that is not the athlete', async () => {
    fitness.getRouteArchive.mockResolvedValue(archive({ swarmRef: SEALED_REF, encrypted: true }));
    human.resolveHumanSession.mockReturnValue(OTHER);
    const res = await arkiv.request(`/archives/${ARCHIVE_KEY}/gpx`, authed);
    expect(res.status).toBe(403);
    expect(swarm.openReference).not.toHaveBeenCalled();
  });

  it('opens a private route for the athlete session as JSON', async () => {
    fitness.getRouteArchive.mockResolvedValue(archive({ swarmRef: SEALED_REF, encrypted: true }));
    human.resolveHumanSession.mockReturnValue(ATHLETE.toUpperCase().replace('0X', '0x'));
    const res = await arkiv.request(`/archives/${ARCHIVE_KEY}/gpx?format=json`, authed);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ gpx: '<gpx/>' });
    expect(swarm.openReference).toHaveBeenCalledWith(SEALED_REF, expect.any(String));
  });

  it('no longer trusts a wallet query string on effort GPX', async () => {
    fitness.getEffort.mockResolvedValue({ athlete: ATHLETE, swarmRef: SEALED_REF });
    const res = await arkiv.request(`/efforts/${EFFORT_KEY}/gpx?wallet=${ATHLETE}`);
    expect(res.status).toBe(401);
    expect(swarm.openReference).not.toHaveBeenCalled();
  });
});

describe('arkiv live beacons', () => {
  const post = () =>
    arkiv.request('/beacons', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        runId: 'run-123456',
        athlete: OTHER,
        latitude: 19.07,
        longitude: 72.87,
      }),
    });

  it('refuses to move a beacon whose run id belongs to another athlete', async () => {
    fitness.upsertBeacon.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(409);
  });

  it('updates the athlete their own beacon', async () => {
    fitness.upsertBeacon.mockResolvedValue({ key: ARCHIVE_KEY, created: false });
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ key: ARCHIVE_KEY, created: false });
  });
});
