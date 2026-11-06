import { type Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  athleteEfforts,
  athleteRouteArchives,
  createEffort,
  createRouteArchive,
  createSegment,
  endBeacon,
  findSegmentsNear,
  getArkivWriter,
  getBeacon,
  getEffort,
  getRouteArchive,
  getSegment,
  isArkivConfigured,
  type RouteArchiveRecord,
  segmentLeaderboard,
  upsertBeacon,
} from '../lib/arkivFitness.js';
import { contractAddress, getRelayChainConfig } from '../lib/chainConfig.js';
import {
  computeSweatScore,
  encodeGeohash,
  type HeartRateSample,
  matchSegmentEffort,
  segmentFromTrack,
  type TimedPoint,
  toGpx,
} from '../lib/fitness/index.js';
import { isWalletBanned, resolveHumanSession } from '../lib/humanPass.js';
import { getPush } from '../lib/pushRuntime.js';
import { RELAY_ABIS } from '../lib/relayAbis.js';
import { getRelayerPublicClient } from '../lib/relayer.js';
import { watchEffort } from '../lib/segmentEffortNews.js';
import { store } from '../lib/store.js';
import {
  downloadFromSwarm,
  isSealedReference,
  isSwarmConfigured,
  openReference,
  sealReference,
  swarmGatewayLink,
  uploadToSwarm,
} from '../lib/swarm.js';

export const arkiv = new Hono();

const effortNewsDeps = {
  board: async (segmentKey: string, verifiedOnly: boolean) =>
    (await segmentLeaderboard(segmentKey, { verifiedOnly })).map((e) => ({
      athlete: e.athlete,
      elapsedSec: e.elapsedSec,
    })),
  notify: (
    to: `0x${string}`,
    message: Parameters<ReturnType<typeof getPush>['sender']['notify']>[1]
  ) => getPush().sender.notify(to, message),
};

const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HEX_KEY_RE = /^0x[0-9a-fA-F]{64}$/;
const MAX_TRACK_POINTS = 20_000;
const NEARBY_PRECISION = 4;
const MAX_CANDIDATE_CELLS = 6;
const ARKIV_EXPLORER = 'https://rabdi.explorer.arkiv.network';

function isLatLng(p: unknown): p is { latitude: number; longitude: number } {
  if (!p || typeof p !== 'object') return false;
  const { latitude, longitude } = p as Record<string, unknown>;
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

function isTimedPoint(p: unknown): p is TimedPoint {
  return isLatLng(p) && typeof (p as Record<string, unknown>).timestamp === 'number';
}

async function currentSeasonId(): Promise<number> {
  try {
    const config = getRelayChainConfig();
    const season = (await getRelayerPublicClient().readContract({
      address: contractAddress(config, 'seasonManager'),
      abi: RELAY_ABIS.seasonManager,
      functionName: 'getCurrentSeason',
    })) as { id: bigint; isActive: boolean };
    return Number(season.id);
  } catch {
    return 0;
  }
}

/**
 * Stores the GPX on Swarm and writes the run's `stryde_route_archive` entity pointing at it.
 * Each step is best effort: a failed upload or entity never fails the activity.
 */
async function archiveRoute(input: {
  athlete: `0x${string}`;
  activityId: number;
  name: string;
  distanceM: number;
  track: TimedPoint[];
  encrypted: boolean;
}) {
  const none = { swarmRef: null, swarmLink: null, archiveKey: null, archiveTxHash: null };
  if (!isSwarmConfigured()) return none;
  let swarmRef: string;
  let swarmLink: string | null;
  try {
    const startedAt = new Date(input.track[0]?.timestamp ?? Date.now());
    const reference = await uploadToSwarm(toGpx(input.name, input.track), {
      encrypt: input.encrypted,
      name: `stryde-run-${startedAt.toISOString().slice(0, 16).replace(/[-:T]/g, '')}.gpx`,
    });
    swarmRef = input.encrypted ? sealReference(reference, input.athlete) : reference;
    swarmLink = input.encrypted ? null : swarmGatewayLink(reference);
  } catch (error) {
    console.warn('[arkiv] Swarm upload failed, continuing without GPX:', error);
    return none;
  }
  if (!isArkivConfigured()) return { ...none, swarmRef, swarmLink };
  try {
    const archive = await createRouteArchive({
      athlete: input.athlete,
      activityId: input.activityId,
      recordedAt: input.track[0]?.timestamp ?? Date.now(),
      swarmRef,
      encrypted: input.encrypted,
      distanceM: input.distanceM,
      pointCount: input.track.length,
      contentType: 'application/gpx+xml',
    });
    return { swarmRef, swarmLink, archiveKey: archive.key, archiveTxHash: archive.txHash };
  } catch (error) {
    console.warn('[arkiv] Route archive entity failed:', error);
    return { ...none, swarmRef, swarmLink };
  }
}

// Activity matching still returns the wearable sweat score without Arkiv;
// everything else needs it.
arkiv.use('*', async (c, next) => {
  const optional = c.req.path.endsWith('/activities/match') || c.req.path.endsWith('/info');
  if (!optional && !isArkivConfigured()) {
    return c.json({ error: 'Arkiv is not configured on this server' }, 503);
  }
  await next();
});

arkiv.get('/info', (c) => {
  if (!isArkivConfigured()) return c.json({ arkiv: false, swarm: isSwarmConfigured() });
  const writer = getArkivWriter();
  return c.json({
    arkiv: true,
    writer,
    chainId: 7794095,
    explorer: `${ARKIV_EXPLORER}/address/${writer}`,
    swarm: isSwarmConfigured(),
  });
});

arkiv.post('/segments', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    name?: string;
    sportType?: number;
    track?: unknown[];
    creator?: string;
  } | null;
  if (!body?.name || body.name.length > 80)
    return c.json({ error: 'name (max 80 chars) required' }, 400);
  if (!body.creator || !HEX_ADDRESS_RE.test(body.creator))
    return c.json({ error: 'creator address required' }, 400);
  if (!Array.isArray(body.track) || body.track.length < 2 || !body.track.every(isLatLng)) {
    return c.json(
      { error: 'track must be an array of at least 2 {latitude, longitude} points' },
      400
    );
  }
  if (isWalletBanned(body.creator))
    return c.json({ error: 'This athlete is suspended from Stryde.' }, 403);

  const geometry = segmentFromTrack(body.track as Array<{ latitude: number; longitude: number }>);
  if (!geometry || geometry.distanceM < 100 || geometry.distanceM > 50_000) {
    return c.json({ error: 'Segments must be between 100 m and 50 km long' }, 400);
  }

  const created = await createSegment({
    name: body.name,
    sportType: Number(body.sportType ?? 0),
    geohash: encodeGeohash(geometry.start.latitude, geometry.start.longitude, 7),
    start: geometry.start,
    end: geometry.end,
    distanceM: geometry.distanceM,
    creator: body.creator as `0x${string}`,
  });
  return c.json({ ...created, distanceM: geometry.distanceM }, 201);
});

arkiv.get('/segments', async (c) => {
  const lat = Number(c.req.query('lat'));
  const lng = Number(c.req.query('lng'));
  if (!isLatLng({ latitude: lat, longitude: lng }))
    return c.json({ error: 'lat and lng required' }, 400);
  const prefix = encodeGeohash(lat, lng, NEARBY_PRECISION);
  return c.json({ geohashPrefix: prefix, segments: await findSegmentsNear(prefix) });
});

arkiv.get('/segments/:key', async (c) => {
  const key = c.req.param('key');
  if (!HEX_KEY_RE.test(key)) return c.json({ error: 'Invalid segment key' }, 400);
  const segment = await getSegment(key as `0x${string}`);
  return segment ? c.json(segment) : c.json({ error: 'Segment not found or expired' }, 404);
});

arkiv.get('/segments/:key/leaderboard', async (c) => {
  const key = c.req.param('key');
  if (!HEX_KEY_RE.test(key)) return c.json({ error: 'Invalid segment key' }, 400);
  const verifiedOnly = c.req.query('scope') !== 'all';
  const banned = new Set(store.listBannedWallets());
  const efforts = (await segmentLeaderboard(key, { verifiedOnly })).filter(
    (e) => !banned.has(e.athlete.toLowerCase())
  );
  return c.json({ segmentKey: key, verifiedOnly, efforts });
});

arkiv.get('/athletes/:wallet/efforts', async (c) => {
  const wallet = c.req.param('wallet');
  if (!HEX_ADDRESS_RE.test(wallet)) return c.json({ error: 'Invalid wallet' }, 400);
  return c.json({ efforts: await athleteEfforts(wallet as `0x${string}`) });
});

/**
 * Called after an activity is recorded: scores the wearable heart-rate trace,
 * stores the full GPX on Swarm, matches the timed track against nearby
 * segments and writes one Stryde-attested effort per matched segment.
 */
arkiv.post(
  '/activities/match',
  bodyLimit({
    maxSize: 2 * 1024 * 1024,
    onError: (c) => c.json({ error: 'Payload too large' }, 413),
  }),
  async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      athlete?: string;
      activityId?: number;
      name?: string;
      distanceM?: number;
      track?: unknown[];
      heartRate?: { samples?: HeartRateSample[]; restingBpm?: number };
      privateRoute?: boolean;
      /** Only score the heart-rate trace (re-sync); no Swarm upload or efforts. */
      scoreOnly?: boolean;
    } | null;

    if (!body?.athlete || !HEX_ADDRESS_RE.test(body.athlete))
      return c.json({ error: 'athlete required' }, 400);
    if (
      !Array.isArray(body.track) ||
      body.track.length < 2 ||
      body.track.length > MAX_TRACK_POINTS
    ) {
      return c.json({ error: `track must have 2-${MAX_TRACK_POINTS} points` }, 400);
    }
    if (!body.track.every(isTimedPoint))
      return c.json({ error: 'track points need latitude, longitude, timestamp' }, 400);

    const athlete = body.athlete as `0x${string}`;
    if (isWalletBanned(athlete))
      return c.json({ error: 'This athlete is suspended from Stryde.' }, 403);

    const track = (body.track as TimedPoint[]).slice().sort((a, b) => a.timestamp - b.timestamp);
    const first = track[0];
    const last = track[track.length - 1];
    if (!first || !last)
      return c.json({ error: `track must have 2-${MAX_TRACK_POINTS} points` }, 400);
    const sweat = computeSweatScore({
      samples: Array.isArray(body.heartRate?.samples) ? body.heartRate.samples : [],
      restingBpm: body.heartRate?.restingBpm,
      activityStart: first.timestamp,
      activityEnd: last.timestamp,
      distanceM: Number(body.distanceM ?? 0),
    });

    const link = store.findLinkByWallet(athlete);
    const verifiedHuman = Boolean(link);
    if (body.scoreOnly) {
      return c.json({
        sweat,
        verifiedHuman,
        swarmRef: null,
        swarmLink: null,
        segmentsChecked: 0,
        efforts: [],
      });
    }

    const { swarmRef, swarmLink, archiveKey, archiveTxHash } = await archiveRoute({
      athlete,
      activityId: Number(body.activityId ?? 0),
      name: body.name ?? 'Stryde activity',
      distanceM: Number(body.distanceM ?? 0),
      track,
      encrypted: Boolean(body.privateRoute),
    });

    if (!isArkivConfigured()) {
      return c.json({
        sweat,
        verifiedHuman,
        swarmRef,
        swarmLink,
        archiveKey: null,
        segmentsChecked: 0,
        efforts: [],
      });
    }

    const cells = [
      ...new Set(track.map((p) => encodeGeohash(p.latitude, p.longitude, NEARBY_PRECISION))),
    ].slice(0, MAX_CANDIDATE_CELLS);
    const candidates = new Map<string, Awaited<ReturnType<typeof findSegmentsNear>>[number]>();
    for (const cell of cells) {
      for (const segment of await findSegmentsNear(cell)) candidates.set(segment.key, segment);
    }

    const seasonId = await currentSeasonId();
    const efforts = [];
    for (const segment of candidates.values()) {
      const match = matchSegmentEffort(track, segment);
      if (!match) continue;
      const announce = await watchEffort(effortNewsDeps, { athlete, verifiedHuman, segment });
      const created = await createEffort({
        segmentKey: segment.key,
        athlete,
        elapsedSec: match.elapsedSec,
        seasonId,
        verifiedHuman,
        sweatVerified: sweat.verified,
        sweatScore: sweat.score,
        avgBpm: sweat.sampleCount ? sweat.avgBpm : null,
        activityId: Number(body.activityId ?? 0),
        recordedAt: match.startedAt,
        // A sealed reference overflows the 128-byte `str` column; the run's archive entity holds it.
        swarmRef: swarmLink ? swarmRef : null,
      });
      await announce(match.elapsedSec).catch((error) =>
        console.warn('[arkiv] Segment news push failed:', error)
      );
      efforts.push({
        ...created,
        segmentKey: segment.key,
        segmentName: segment.name,
        elapsedSec: match.elapsedSec,
      });
    }

    return c.json({
      sweat,
      verifiedHuman,
      swarmRef,
      swarmLink,
      archiveKey,
      archiveTxHash,
      segmentsChecked: candidates.size,
      efforts,
    });
  }
);

/**
 * A sealed reference opens only for a signed session of the athlete it was sealed for:
 * the wallet comes from the session, never from the request.
 */
async function sendGpx(c: Context, ref: string, athlete: string, asJson: boolean) {
  if (!isSwarmConfigured()) return c.json({ error: 'Swarm is not configured' }, 503);
  let reference = ref;
  if (isSealedReference(ref)) {
    const wallet = resolveHumanSession(c.req.header('authorization'));
    if (!wallet) {
      c.header('WWW-Authenticate', 'Bearer error="invalid_token"');
      return c.json({ error: 'Sign in with your wallet first', code: 'session_required' }, 401);
    }
    if (wallet.toLowerCase() !== athlete.toLowerCase()) {
      return c.json({ error: 'Only the athlete can open a private route' }, 403);
    }
    try {
      reference = openReference(ref, wallet);
    } catch {
      return c.json({ error: 'Route is private or unavailable' }, 403);
    }
  }
  try {
    const gpx = await downloadFromSwarm(reference);
    return asJson
      ? c.json({ gpx })
      : c.body(gpx, 200, { 'content-type': 'application/gpx+xml' });
  } catch {
    return c.json({ error: 'Route is unavailable on Swarm' }, 502);
  }
}

function publicArchive(archive: RouteArchiveRecord) {
  const { swarmRef, ...rest } = archive;
  return {
    ...rest,
    swarmRef: archive.encrypted ? null : swarmRef,
    swarmLink: archive.encrypted ? null : swarmGatewayLink(swarmRef),
    explorer: `${ARKIV_EXPLORER}/entity/${archive.key}`,
  };
}

arkiv.get('/archives/:key', async (c) => {
  const key = c.req.param('key');
  if (!HEX_KEY_RE.test(key)) return c.json({ error: 'Invalid archive key' }, 400);
  const archive = await getRouteArchive(key as `0x${string}`);
  return archive
    ? c.json(publicArchive(archive))
    : c.json({ error: 'Archive not found or expired' }, 404);
});

arkiv.get('/archives/:key/gpx', async (c) => {
  const key = c.req.param('key');
  if (!HEX_KEY_RE.test(key)) return c.json({ error: 'Invalid archive key' }, 400);
  const archive = await getRouteArchive(key as `0x${string}`);
  if (!archive) return c.json({ error: 'Archive not found or expired' }, 404);
  return sendGpx(c, archive.swarmRef, archive.athlete, c.req.query('format') === 'json');
});

arkiv.get('/athletes/:wallet/archives', async (c) => {
  const wallet = c.req.param('wallet');
  if (!HEX_ADDRESS_RE.test(wallet)) return c.json({ error: 'Invalid wallet' }, 400);
  const archives = await athleteRouteArchives(wallet as `0x${string}`);
  return c.json({ archives: archives.map(publicArchive) });
});

arkiv.get('/efforts/:key/gpx', async (c) => {
  const key = c.req.param('key');
  if (!HEX_KEY_RE.test(key)) return c.json({ error: 'Invalid effort key' }, 400);
  const effort = await getEffort(key as `0x${string}`);
  if (!effort?.swarmRef) return c.json({ error: 'No route archived for this effort' }, 404);
  return sendGpx(c, effort.swarmRef, effort.athlete, c.req.query('format') === 'json');
});

arkiv.post('/beacons', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    runId?: string;
    athlete?: string;
    latitude?: number;
    longitude?: number;
    paceSecPerKm?: number;
    batteryPct?: number | null;
  } | null;
  if (!body?.runId || !/^[A-Za-z0-9_-]{6,64}$/.test(body.runId))
    return c.json({ error: 'runId required' }, 400);
  if (!body.athlete || !HEX_ADDRESS_RE.test(body.athlete))
    return c.json({ error: 'athlete required' }, 400);
  const position = { latitude: body.latitude, longitude: body.longitude };
  if (!isLatLng(position)) return c.json({ error: 'latitude and longitude required' }, 400);

  const result = await upsertBeacon({
    runId: body.runId,
    athlete: body.athlete as `0x${string}`,
    geohash: encodeGeohash(position.latitude, position.longitude, 7),
    latitude: position.latitude,
    longitude: position.longitude,
    paceSecPerKm: Number(body.paceSecPerKm ?? 0),
    batteryPct: typeof body.batteryPct === 'number' ? body.batteryPct : null,
  });
  return c.json(result);
});

arkiv.get('/beacons/:runId', async (c) => {
  const beacon = await getBeacon(c.req.param('runId'));
  return beacon ? c.json(beacon) : c.json({ error: 'Beacon ended or expired' }, 404);
});

arkiv.delete('/beacons/:runId', async (c) => {
  return c.json({ ended: await endBeacon(c.req.param('runId')) });
});
