import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
  NoEntityFoundError,
} from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { and, asc, eq, startsWith } from '@arkiv-network/sdk/query';
import {
  addr,
  bool,
  bytes,
  dec,
  defineSchema,
  i32,
  key,
  str,
  u64,
} from '@arkiv-network/sdk/schema';
import { hexToString, http, stringToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Stryde's social/ephemeral layer on Arkiv. The Stryde writer wallet creates
 * every effort and segment (so `$creator` attests Stryde validated it), then
 * hands ownership to the athlete (`$owner`) so the data is theirs. Leaderboard
 * queries filter on `createdBy(writer)`, which makes forged efforts invisible.
 */

export const Segments = defineSchema('stryde_segment', {
  name: str(),
  sportType: i32().indexed(),
  /** 7-char geohash of the start gate; prefix queries find nearby segments. */
  geohash: str().indexed(),
  startLat: dec(),
  startLng: dec(),
  endLat: dec(),
  endLng: dec(),
  distanceM: u64().indexed(),
  creator: addr().indexed(),
});

export const Efforts = defineSchema('stryde_effort', {
  segmentKey: str().indexed(),
  athlete: addr().indexed(),
  elapsedSec: u64().indexed(),
  seasonId: u64().indexed(),
  verifiedHuman: bool().indexed(),
  sweatVerified: bool().indexed(),
  sweatScore: i32(),
  avgBpm: i32().optional(),
  activityId: u64(),
  recordedAt: u64(),
  /** Swarm reference of the full GPX; `enc:` prefix means encrypted for the athlete only. */
  swarmRef: str().optional(),
});

/**
 * One per recorded activity: the GPX lives on Swarm and this entity is how anyone finds it.
 * A public route holds the plain Swarm reference; a private one holds it sealed (`enc:v1:`),
 * because an encrypted Swarm reference carries its own decryption key and entities are public.
 */
export const RouteArchives = defineSchema('stryde_route_archive', {
  athlete: addr().indexed(),
  activityId: u64().indexed(),
  recordedAt: u64().indexed(),
  swarmRef: str().optional(),
  /** A sealed reference is ~220 chars, over the 128-byte `str` limit, so it is stored as bytes. */
  sealedRef: bytes().optional(),
  encrypted: bool().indexed(),
  distanceM: u64(),
  pointCount: u64(),
  contentType: str(),
});

export const Beacons = defineSchema('stryde_beacon', {
  runId: str().indexed(),
  athlete: addr().indexed(),
  geohash: str().indexed(),
  lat: dec(),
  lng: dec(),
  paceSecPerKm: i32(),
  batteryPct: i32().optional(),
  updatedAt: u64(),
});

/** A beacon disappears this long after its last update — a stopped phone stops leaking location. */
export const BEACON_TTL_MINUTES = 10;
export const EFFORT_TTL_DAYS = 120;
// Rabdi caps entity lifetime at 7,884,000 blocks (~182 days at 2s blocks).
export const SEGMENT_TTL_DAYS = 180;
export const ARCHIVE_TTL_DAYS = 180;

type ArkivPublic = ReturnType<typeof createPublicClient>;
type ArkivWallet = ReturnType<typeof createWalletClient>;

let publicClient: ArkivPublic | null = null;
let walletClient: ArkivWallet | null = null;
let writerAddress: `0x${string}` | null = null;

function chain() {
  return rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? '' });
}

export function isArkivConfigured(): boolean {
  return Boolean(process.env.ARKIV_PRIVATE_KEY);
}

export function getArkivPublic(): ArkivPublic {
  publicClient ??= createPublicClient({ chain: chain(), transport: http() });
  return publicClient;
}

export function getArkivWallet(): ArkivWallet {
  if (walletClient) return walletClient;
  const key = process.env.ARKIV_PRIVATE_KEY;
  if (!key) throw new Error('[arkiv] Missing env var: ARKIV_PRIVATE_KEY');
  const account = privateKeyToAccount(key as `0x${string}`);
  writerAddress = account.address;
  walletClient = createWalletClient({ chain: chain(), transport: http(), account });
  return walletClient;
}

export function getArkivWriter(): `0x${string}` {
  getArkivWallet();
  if (!writerAddress) throw new Error('[arkiv] Writer address unavailable');
  return writerAddress;
}

export interface SegmentRecord {
  key: `0x${string}`;
  name: string;
  sportType: number;
  geohash: string;
  start: { latitude: number; longitude: number };
  end: { latitude: number; longitude: number };
  distanceM: number;
  creator: string;
  owner: string;
}

export interface EffortRecord {
  key: `0x${string}`;
  segmentKey: string;
  athlete: string;
  elapsedSec: number;
  seasonId: number;
  verifiedHuman: boolean;
  sweatVerified: boolean;
  sweatScore: number;
  avgBpm: number | null;
  activityId: number;
  recordedAt: number;
  swarmRef: string | null;
  owner: string;
}

export interface BeaconRecord {
  key: `0x${string}`;
  runId: string;
  athlete: string;
  latitude: number;
  longitude: number;
  paceSecPerKm: number;
  batteryPct: number | null;
  updatedAt: number;
  expiresAt: number | null;
}

const fixed = (n: number) => dec(n.toFixed(7));

export async function createSegment(input: {
  name: string;
  sportType: number;
  geohash: string;
  start: { latitude: number; longitude: number };
  end: { latitude: number; longitude: number };
  distanceM: number;
  creator: `0x${string}`;
}): Promise<{ key: `0x${string}`; txHash: `0x${string}` }> {
  const wallet = getArkivWallet();
  const { entityKey, txHash } = await wallet.createEntity(
    Segments,
    {
      name: input.name,
      sportType: i32(input.sportType),
      geohash: input.geohash,
      startLat: fixed(input.start.latitude),
      startLng: fixed(input.start.longitude),
      endLat: fixed(input.end.latitude),
      endLng: fixed(input.end.longitude),
      distanceM: u64(BigInt(Math.round(input.distanceM))),
      creator: addr(input.creator),
    },
    { expiration: ExpirationTime.fromDays(SEGMENT_TTL_DAYS) }
  );
  await wallet.changeOwnership({ entityKey, newOwner: input.creator });
  return { key: entityKey, txHash };
}

function segmentFromRow(row: Record<string, unknown>): SegmentRecord {
  const v = (name: string) => (row[name] as { value: unknown } | undefined)?.value;
  return {
    key: row.$key as `0x${string}`,
    name: String(v('name') ?? ''),
    sportType: Number(v('sportType') ?? 0),
    geohash: String(v('geohash') ?? ''),
    start: { latitude: Number(v('startLat')), longitude: Number(v('startLng')) },
    end: { latitude: Number(v('endLat')), longitude: Number(v('endLng')) },
    distanceM: Number(v('distanceM') ?? 0),
    creator: String(v('creator') ?? ''),
    owner: String(row.$owner ?? ''),
  };
}

export async function findSegmentsNear(
  geohashPrefix: string,
  limit = 50
): Promise<SegmentRecord[]> {
  const result = await getArkivPublic()
    .select()
    .from(Segments)
    .where(startsWith('geohash', geohashPrefix))
    .createdBy(getArkivWriter())
    .limit(limit)
    .fetch();
  return result.entities.map((row) => segmentFromRow(row as unknown as Record<string, unknown>));
}

export async function getSegment(segmentKey: `0x${string}`): Promise<SegmentRecord | null> {
  const result = await getArkivPublic()
    .select()
    .from(Segments)
    .where(eq('$key', key(segmentKey)))
    .limit(1)
    .fetch();
  const row = result.entities[0];
  return row ? segmentFromRow(row as unknown as Record<string, unknown>) : null;
}

export async function createEffort(input: {
  segmentKey: string;
  athlete: `0x${string}`;
  elapsedSec: number;
  seasonId: number;
  verifiedHuman: boolean;
  sweatVerified: boolean;
  sweatScore: number;
  avgBpm: number | null;
  activityId: number;
  recordedAt: number;
  swarmRef: string | null;
}): Promise<{ key: `0x${string}`; txHash: `0x${string}` }> {
  const wallet = getArkivWallet();
  const { entityKey, txHash } = await wallet.createEntity(
    Efforts,
    {
      segmentKey: input.segmentKey,
      athlete: addr(input.athlete),
      elapsedSec: u64(BigInt(input.elapsedSec)),
      seasonId: u64(BigInt(input.seasonId)),
      verifiedHuman: input.verifiedHuman,
      sweatVerified: input.sweatVerified,
      sweatScore: i32(input.sweatScore),
      avgBpm: input.avgBpm === null ? undefined : i32(input.avgBpm),
      activityId: u64(BigInt(input.activityId)),
      recordedAt: u64(BigInt(input.recordedAt)),
      swarmRef: input.swarmRef ?? undefined,
    },
    { expiration: ExpirationTime.fromDays(EFFORT_TTL_DAYS) }
  );
  await wallet.changeOwnership({ entityKey, newOwner: input.athlete });
  return { key: entityKey, txHash };
}

function effortFromRow(row: Record<string, unknown>): EffortRecord {
  const v = (name: string) => (row[name] as { value: unknown } | undefined)?.value;
  const avg = v('avgBpm');
  const ref = v('swarmRef');
  return {
    key: row.$key as `0x${string}`,
    segmentKey: String(v('segmentKey') ?? ''),
    athlete: String(v('athlete') ?? ''),
    elapsedSec: Number(v('elapsedSec') ?? 0),
    seasonId: Number(v('seasonId') ?? 0),
    verifiedHuman: Boolean(v('verifiedHuman')),
    sweatVerified: Boolean(v('sweatVerified')),
    sweatScore: Number(v('sweatScore') ?? 0),
    avgBpm: avg === undefined ? null : Number(avg),
    activityId: Number(v('activityId') ?? 0),
    recordedAt: Number(v('recordedAt') ?? 0),
    swarmRef: ref === undefined ? null : String(ref),
    owner: String(row.$owner ?? ''),
  };
}

/** Fastest effort per athlete on a segment, from Stryde-attested efforts only. */
export async function segmentLeaderboard(
  segmentKey: string,
  options: { verifiedOnly: boolean; limit?: number }
): Promise<EffortRecord[]> {
  const filter = options.verifiedOnly
    ? and(eq('segmentKey', segmentKey), eq('verifiedHuman', true))
    : eq('segmentKey', segmentKey);
  const result = await getArkivPublic()
    .select()
    .from(Efforts)
    .where(filter)
    .createdBy(getArkivWriter())
    .orderBy(asc('elapsedSec'))
    .limit(100)
    .fetch();

  const best = new Map<string, EffortRecord>();
  for (const row of result.entities) {
    const effort = effortFromRow(row as unknown as Record<string, unknown>);
    const athlete = effort.athlete.toLowerCase();
    if (!best.has(athlete)) best.set(athlete, effort);
  }
  return [...best.values()].slice(0, options.limit ?? 20);
}

export async function athleteEfforts(athlete: `0x${string}`, limit = 50): Promise<EffortRecord[]> {
  const result = await getArkivPublic()
    .select()
    .from(Efforts)
    .where(eq('athlete', addr(athlete)))
    .createdBy(getArkivWriter())
    .limit(limit)
    .fetch();
  return result.entities.map((row) => effortFromRow(row as unknown as Record<string, unknown>));
}

export async function getEffort(effortKey: `0x${string}`): Promise<EffortRecord | null> {
  const row = await getStrydeEntity(effortKey, Efforts);
  return row ? effortFromRow(row) : null;
}

export interface RouteArchiveRecord {
  key: `0x${string}`;
  athlete: string;
  activityId: number;
  recordedAt: number;
  swarmRef: string;
  encrypted: boolean;
  distanceM: number;
  pointCount: number;
  contentType: string;
  owner: string;
  expiresAt: number | null;
}

export async function createRouteArchive(input: {
  athlete: `0x${string}`;
  activityId: number;
  recordedAt: number;
  swarmRef: string;
  encrypted: boolean;
  distanceM: number;
  pointCount: number;
  contentType: string;
}): Promise<{ key: `0x${string}`; txHash: `0x${string}` }> {
  const wallet = getArkivWallet();
  const { entityKey, txHash } = await wallet.createEntity(
    RouteArchives,
    {
      athlete: addr(input.athlete),
      activityId: u64(BigInt(input.activityId)),
      recordedAt: u64(BigInt(input.recordedAt)),
      swarmRef: input.encrypted ? undefined : input.swarmRef,
      sealedRef: input.encrypted ? bytes(stringToHex(input.swarmRef)) : undefined,
      encrypted: input.encrypted,
      distanceM: u64(BigInt(Math.max(0, Math.round(input.distanceM)))),
      pointCount: u64(BigInt(input.pointCount)),
      contentType: input.contentType,
    },
    { expiration: ExpirationTime.fromDays(ARCHIVE_TTL_DAYS) }
  );
  // Arkiv reverts a transfer to the current owner (TransferToSelf).
  if (input.athlete.toLowerCase() !== getArkivWriter().toLowerCase()) {
    await wallet.changeOwnership({ entityKey, newOwner: input.athlete });
  }
  return { key: entityKey, txHash };
}

function archiveFromRow(row: Record<string, unknown>): RouteArchiveRecord {
  const v = (name: string) => (row[name] as { value: unknown } | undefined)?.value;
  const sealed = v('sealedRef');
  return {
    key: row.$key as `0x${string}`,
    athlete: String(v('athlete') ?? ''),
    activityId: Number(v('activityId') ?? 0),
    recordedAt: Number(v('recordedAt') ?? 0),
    swarmRef: sealed ? hexToString(sealed as `0x${string}`) : String(v('swarmRef') ?? ''),
    encrypted: Boolean(v('encrypted')),
    distanceM: Number(v('distanceM') ?? 0),
    pointCount: Number(v('pointCount') ?? 0),
    contentType: String(v('contentType') ?? ''),
    owner: String(row.$owner ?? ''),
    expiresAt: row.$expiresAt === undefined ? null : Number(row.$expiresAt),
  };
}

/**
 * One entity by key, or null when it is missing, expired or was not written by Stryde:
 * anyone can create an entity with our schema names.
 */
async function getStrydeEntity(
  entityKey: `0x${string}`,
  schema: typeof RouteArchives | typeof Efforts
): Promise<Record<string, unknown> | null> {
  let row: Record<string, unknown>;
  try {
    row = (await getArkivPublic().getEntity(entityKey, schema)) as unknown as Record<
      string,
      unknown
    >;
  } catch (error) {
    if (error instanceof NoEntityFoundError) return null;
    throw error;
  }
  const creator = String(row.$creator ?? '').toLowerCase();
  return creator === getArkivWriter().toLowerCase() ? row : null;
}

export async function getRouteArchive(
  archiveKey: `0x${string}`
): Promise<RouteArchiveRecord | null> {
  const row = await getStrydeEntity(archiveKey, RouteArchives);
  return row ? archiveFromRow(row) : null;
}

export async function athleteRouteArchives(
  athlete: `0x${string}`,
  limit = 50
): Promise<RouteArchiveRecord[]> {
  const result = await getArkivPublic()
    .select()
    .from(RouteArchives)
    .where(eq('athlete', addr(athlete)))
    .createdBy(getArkivWriter())
    .limit(limit)
    .fetch();
  return result.entities.map((row) => archiveFromRow(row as unknown as Record<string, unknown>));
}

async function findBeaconRow(runId: string) {
  const result = await getArkivPublic()
    .select()
    .from(Beacons)
    .where(eq('runId', runId))
    .createdBy(getArkivWriter())
    .limit(1)
    .fetch();
  return result.entities[0] as unknown as Record<string, unknown> | undefined;
}

function beaconFromRow(row: Record<string, unknown>): BeaconRecord {
  const v = (name: string) => (row[name] as { value: unknown } | undefined)?.value;
  const battery = v('batteryPct');
  return {
    key: row.$key as `0x${string}`,
    runId: String(v('runId') ?? ''),
    athlete: String(v('athlete') ?? ''),
    latitude: Number(v('lat')),
    longitude: Number(v('lng')),
    paceSecPerKm: Number(v('paceSecPerKm') ?? 0),
    batteryPct: battery === undefined ? null : Number(battery),
    updatedAt: Number(v('updatedAt') ?? 0),
    expiresAt: row.$expiresAt === undefined ? null : Number(row.$expiresAt),
  };
}

export async function upsertBeacon(input: {
  runId: string;
  athlete: `0x${string}`;
  geohash: string;
  latitude: number;
  longitude: number;
  paceSecPerKm: number;
  batteryPct: number | null;
}): Promise<{ key: `0x${string}`; created: boolean }> {
  const wallet = getArkivWallet();
  const values = {
    geohash: input.geohash,
    lat: fixed(input.latitude),
    lng: fixed(input.longitude),
    paceSecPerKm: i32(Math.round(input.paceSecPerKm)),
    batteryPct: input.batteryPct === null ? undefined : i32(Math.round(input.batteryPct)),
    updatedAt: u64(BigInt(Date.now())),
  };

  const existing = await findBeaconRow(input.runId);
  if (existing) {
    const key = existing.$key as `0x${string}`;
    await wallet.executeBatch({
      patches: [{ schema: Beacons, entityKey: key, set: values }],
      extensions: [{ entityKey: key, expiration: ExpirationTime.fromMinutes(BEACON_TTL_MINUTES) }],
    });
    return { key, created: false };
  }

  const { entityKey } = await wallet.createEntity(
    Beacons,
    { runId: input.runId, athlete: addr(input.athlete), ...values },
    { expiration: ExpirationTime.fromMinutes(BEACON_TTL_MINUTES) }
  );
  return { key: entityKey, created: true };
}

export async function getBeacon(runId: string): Promise<BeaconRecord | null> {
  const row = await findBeaconRow(runId);
  return row ? beaconFromRow(row) : null;
}

export async function endBeacon(runId: string): Promise<boolean> {
  const row = await findBeaconRow(runId);
  if (!row) return false;
  await getArkivWallet().deleteEntity({ entityKey: row.$key as `0x${string}` });
  return true;
}

/** Ends every live beacon of this athlete (account deletion); says how many were removed. */
export async function endBeaconsFor(athlete: `0x${string}`): Promise<number> {
  const result = await getArkivPublic()
    .select()
    .from(Beacons)
    .where(eq('athlete', addr(athlete)))
    .createdBy(getArkivWriter())
    .limit(100)
    .fetch();
  const wallet = getArkivWallet();
  for (const row of result.entities) {
    await wallet.deleteEntity({ entityKey: row.$key as `0x${string}` });
  }
  return result.entities.length;
}
