import { services } from '@repo/shared';
import { formatUnits } from 'viem';
import { GPS_DISTANCE_SPORTS } from '@/constants/activity';
import type { Clock, IdGenerator } from '@/platform';
import type {
  Activity,
  ActivityEffort,
  ActivityFeel,
  ActivityPrivacy,
  ActivityStream,
  ActivityType,
  BestEffort,
  Lap,
  PrivacyZone,
  Ring,
  Split,
} from '@/types';
import { mapWithConcurrency } from '@/utils/async';
import { chainProof } from '@/utils/chainProof';
import { getActivityName, parsePolyline, toPolyline } from '@/utils/format';
import { logger } from '@/utils/logger';
import { canShareTerritory, publicRoute } from '@/utils/routePrivacy';

/** Everything a finished activity can do onchain, for one wallet. */
export interface ActivityChain {
  recordActivity(params: {
    polyline: string;
    activityType: ActivityType;
    distance: number;
    duration: number;
    territoryArea: number;
    metadata: string;
  }): Promise<{ onchainActivityId: bigint; txHash: `0x${string}`; confirmed: boolean }>;
  /** Null when there is nothing worth storing (no name, description or photos). */
  setMetadata(
    onchainActivityId: bigint,
    metadata: ActivityMetadataInput
  ): Promise<{ cid: string; confirmed: boolean } | null>;
  /** Credits the activity's onchain distance to the season, once per `activityHash`. */
  recordSeasonContribution(activityHash: `0x${string}`, distance: number): Promise<void>;
  mintReward(
    activityHash: `0x${string}`,
    distance: number
  ): Promise<{ amount: bigint; confirmed: boolean }>;
  claimTerritory(
    polygon: Ring,
    areaSqm: number
  ): Promise<{ territoryId: `0x${string}`; confirmed: boolean }>;
  mintTerritoryNft(territoryId: `0x${string}`): Promise<{ confirmed: boolean }>;
}

export interface ActivityMetadataInput {
  name?: string;
  description?: string;
  photos?: string[];
  polyline?: string;
  territory?: Ring | null;
  coordinates?: Array<[number, number]>;
}

export interface PhotoUploader {
  /** Resolves to a public URL for the uploaded photo. */
  upload(name: string, uri: string): Promise<string>;
}

export interface PostRunStore {
  saveActivity(activity: Activity): void;
  updateActivity(id: string, patch: Partial<Activity>): void;
  capturePolygon(userId: string, territory: Ring): void;
}

export interface PostRunDeps {
  clock: Clock;
  ids: IdGenerator;
  userId: string;
  store: PostRunStore;
  uploader: PhotoUploader;
  /** Null when there's no wallet yet: the activity is then saved on this device only. */
  chain: ActivityChain | null;
  isVerified: () => boolean;
  /** Measures save -> confirmed -> visible in search; absent where there is no real network. */
  timing?: ActivityTiming;
}

/** What the post-run pipeline tells the timing measurement. */
export interface ActivityTiming {
  saved(activityId: string): void;
  confirmed(activityId: string, activityHash: `0x${string}`): void;
}

export interface PostRunInput {
  title: string;
  description: string;
  activityType: ActivityType;
  distance: number;
  duration: number;
  polyline: string;
  splits?: Split[];
  stream?: ActivityStream;
  gearId?: string;
  bestEfforts?: BestEffort[];
  laps?: Lap[];
  /** Metres climbed and descended, when the recording had an altitude. */
  elevationGain?: number;
  elevationLoss?: number;
  /** From a watch or band, when the workout came with it. */
  heartRate?: { avg: number; max: number };
  /** Energy the device measured, which the app prefers over its own estimate. */
  caloriesBurned?: number;
  territory: Ring | null;
  territoryArea: number;
  photos: string[];
  privacy: ActivityPrivacy;
  feel?: ActivityFeel;
  effort?: ActivityEffort;
  isCommute?: boolean;
  privateNote?: string;
  isManual: boolean;
  /** When the workout began, in ms: for an import, which happened before it was saved. Defaults to now. */
  startedAt?: number;
  /** Trim the route's ends from what gets published (the device keeps it whole). */
  hideRouteEnds?: boolean;
  /** Share the activity without its route map or territory outline (the device keeps both). */
  hideRoute?: boolean;
  /** Recorded with a simulated location: anchored, but no reward, season credit or territory. */
  mocked?: boolean;
  /** Places whose surroundings are cut from the published route; saved with the activity. */
  privacyZones?: PrivacyZone[];
}

export type StepOutcome =
  | { status: 'ok' }
  | { status: 'failed'; error: unknown }
  | { status: 'skipped'; reason: string };

export interface PostRunResult {
  activity: Activity;
  /** Has a territory to claim but the user hasn't verified with World ID. */
  needsVerification: boolean;
  /** The activity or its territory claim didn't make it onchain (the failures the user must hear about). */
  onchainFailed: boolean;
  steps: {
    record: StepOutcome;
    metadata: StepOutcome;
    season: StepOutcome;
    reward: StepOutcome;
    territory: StepOutcome;
    territoryNft: StepOutcome;
  };
}

const PHOTO_UPLOADS_AT_ONCE = 3;

/** Activities whose onchain steps are running right now, so nothing starts a second run on one. */
const syncing = new Set<string>();

export const isSyncing = (activityId: string): boolean => syncing.has(activityId);

async function withSyncLock<T>(activityId: string, run: () => Promise<T>): Promise<T> {
  syncing.add(activityId);
  try {
    return await run();
  } finally {
    syncing.delete(activityId);
  }
}
const NO_WALLET: StepOutcome = { status: 'skipped', reason: 'no wallet' };

const ok = (): StepOutcome => ({ status: 'ok' });
const skipped = (reason: string): StepOutcome => ({ status: 'skipped', reason });

const isPublished = (uri: string) => uri.startsWith('http');

/**
 * An Only Me activity publishes none of its details: no name, description, photos or route to
 * IPFS, and no territory claim on the chain. Only the summary is anchored (a hash, the sport, the
 * distance, the time and the area), so it still counts for rewards and totals. Followers-only
 * activities are published like public ones for now: hiding them from everyone else needs the
 * details encrypted, which is not built.
 */
const staysOnDevice = (privacy: ActivityPrivacy | undefined) => privacy === 'only_me';

/** Only photos with a public link mean anything to other devices; a file path is this phone's alone. */
const publishedOnly = (photos: readonly string[]) => photos.filter(isPublished);

/**
 * Uploads the photos that are still only on this device, keeping the order. One that will not
 * upload stays as its local path so the athlete keeps seeing it; a retry tries it again.
 */
async function uploadPhotos(
  uris: readonly string[],
  { clock, uploader }: Pick<PostRunDeps, 'clock' | 'uploader'>
): Promise<string[]> {
  return mapWithConcurrency(
    uris,
    async (uri) => {
      if (isPublished(uri)) return uri;
      try {
        return await uploader.upload(`activity-${clock.now()}`, uri);
      } catch (err) {
        logger.warn('[PostRun] Photo upload failed, keeping it on this device for now', err);
        return uri;
      }
    },
    PHOTO_UPLOADS_AT_ONCE
  );
}

/** The relayer answers 409 when it already has this write (the error carries its HTTP status). */
const isConflict = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'status' in error && error.status === 409;

/** Runs one best-effort step, turning a throw into data so the next step still runs. */
async function attempt<T>(
  label: string,
  run: () => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    logger.warn(`[PostRun] ${label} failed`, error);
    return { ok: false, error };
  }
}

/** A GPS-recorded activity came back with no usable route: a lost signal, not something to publish. */
export class EmptyRecordingError extends Error {
  constructor() {
    super('Activity too short — the recording has no route.');
    this.name = 'EmptyRecordingError';
  }
}

const MIN_ROUTE_POINTS = 2;

/**
 * Saves a finished activity: first on this device (always), then onchain as
 * far as it gets. Every onchain step reports its own outcome; one failing never
 * stops the others, and nothing here navigates or shows UI.
 */
export async function savePostRun(input: PostRunInput, deps: PostRunDeps): Promise<PostRunResult> {
  const { clock, ids, store } = deps;

  if (
    !input.isManual &&
    GPS_DISTANCE_SPORTS.has(input.activityType) &&
    parsePolyline(input.polyline).length < MIN_ROUTE_POINTS
  ) {
    throw new EmptyRecordingError();
  }

  const now = new Date(input.startedAt ?? clock.now());
  const id = ids.next();
  // The id is part of the hash so two activities with the same route and stats
  // (e.g. manual entries with no polyline) don't collide onchain and revert as a duplicate.
  const activityHash = services.activity.computeActivityHash(
    input.polyline,
    input.territoryArea,
    id
  );

  const activity: Activity = {
    id,
    userId: deps.userId,
    name: input.title.trim() || getActivityName(input.activityType, now.getHours()),
    activityType: input.activityType,
    distance: input.distance,
    duration: input.duration,
    polyline: input.polyline,
    splits: input.splits,
    stream: input.stream,
    gearId: input.gearId,
    bestEfforts: input.bestEfforts,
    laps: input.laps,
    elevationGain: input.elevationGain,
    elevationLoss: input.elevationLoss,
    heartRate: input.heartRate,
    caloriesBurned: input.caloriesBurned,
    hideRouteEnds: input.hideRouteEnds ?? false,
    hideRoute: input.hideRoute || undefined,
    mocked: input.mocked || undefined,
    privacyZones: input.privacyZones,
    territory: input.territory,
    territoryArea: input.territoryArea,
    description: input.description.trim() || undefined,
    feel: input.feel,
    effort: input.effort,
    isCommute: input.isCommute || undefined,
    privateNote: input.privateNote?.trim() || undefined,
    privacy: input.privacy,
    // Photos start as the paths on this device; the links replace them once they are uploaded.
    images: input.photos.length > 0 ? [...input.photos] : undefined,
    isManual: input.isManual,
    activityHash,
    createdAt: now,
  };

  // Safe on this device first: a crash or a slow upload from here on loses nothing, and the background
  // retry finishes whatever is left. The lock is taken in the same breath, so that retry cannot start
  // while the photos are still going up.
  store.saveActivity(activity);
  deps.timing?.saved(id);
  if (input.territory) store.capturePolygon(deps.userId, input.territory);

  const finished = await withSyncLock(id, async () => {
    const photos = staysOnDevice(input.privacy)
      ? [...input.photos]
      : await uploadPhotos(input.photos, deps);
    const published = photos.some((uri, index) => uri !== input.photos[index]);
    const current: Activity = published ? { ...activity, images: photos } : activity;
    if (published) store.updateActivity(id, { images: photos });
    const outcome = await syncOnChain(
      { activity: current, photos: publishedOnly(photos), territory: input.territory },
      deps
    );
    return { current, ...outcome };
  });
  const { current, steps, onchainFailed, needsVerification } = finished;

  return { activity: current, needsVerification, onchainFailed, steps };
}

/** What the onchain steps need: the saved activity plus the published form of its photos and territory. */
interface OnChainSubject {
  activity: Activity;
  photos: string[];
  territory: Ring | null;
}

type OnChainOutcome = Pick<PostRunResult, 'steps' | 'onchainFailed' | 'needsVerification'>;

/**
 * Records a saved activity onchain, as far as it gets. Every step reports its own
 * outcome; one failing never stops the others.
 */
function skipReason(activity: Pick<Activity, 'mocked' | 'privacy'>): string {
  if (activity.mocked) return 'simulated location';
  if (staysOnDevice(activity.privacy)) return 'private activity';
  return 'route hidden';
}

async function syncOnChain(
  { activity, photos, territory }: OnChainSubject,
  deps: Pick<PostRunDeps, 'store' | 'chain' | 'isVerified' | 'timing'>
): Promise<OnChainOutcome> {
  const { store, chain } = deps;
  // The hash is derived from the id, so recomputing it gives the one saved with the activity.
  const activityHash = services.activity.computeActivityHash(
    activity.polyline,
    activity.territoryArea,
    activity.id
  );
  const steps: PostRunResult['steps'] = {
    record: NO_WALLET,
    metadata: NO_WALLET,
    season: NO_WALLET,
    reward: NO_WALLET,
    territory: NO_WALLET,
    territoryNft: NO_WALLET,
  };
  let onchainFailed = false;
  let needsVerification = false;

  if (chain) {
    const record = await attempt('recordActivity', () =>
      chain.recordActivity({
        polyline: activity.polyline,
        activityType: activity.activityType,
        distance: activity.distance,
        duration: activity.duration,
        territoryArea: activity.territoryArea,
        metadata: activity.id,
      })
    );

    if (record.ok) {
      store.updateActivity(activity.id, { txHash: record.value.txHash });
      if (record.value.confirmed) {
        steps.record = ok();
        deps.timing?.confirmed(activity.id, activityHash);
        const onchainActivityId = record.value.onchainActivityId;
        store.updateActivity(activity.id, { onchainActivityId: onchainActivityId.toString() });

        if (staysOnDevice(activity.privacy)) {
          steps.metadata = skipped('private activity');
        } else {
          // Persists name/description/photos/route to IPFS and attaches the CID
          // onchain, so the activity's rich data survives logout or a device switch.
          // That copy is public, so it carries the route without its hidden ends and private places.
          const shared = publicRoute(
            // A hidden route publishes nothing of the route at all.
            activity.hideRoute ? [] : parsePolyline(activity.polyline),
            {
              hideEnds: activity.hideRouteEnds ?? false,
              zones: activity.privacyZones ?? [],
              seed: activity.id,
            }
          );
          const metadata = await attempt('activity metadata', () =>
            chain.setMetadata(onchainActivityId, {
              name: activity.name,
              description: activity.description,
              photos: photos.length > 0 ? photos : undefined,
              polyline: shared.route.length > 0 ? toPolyline(shared.route) : undefined,
              // The loop's outline would point back at a hidden place, so it stays private then.
              territory: canShareTerritory(activity, shared.cutByZone)
                ? (territory ?? undefined)
                : undefined,
              // The chain stores only a hash/distance/duration/area: this is the
              // one durable place the real route shape lives.
              coordinates: shared.route.length > 0 ? shared.route : undefined,
            })
          );
          if (!metadata.ok) {
            steps.metadata = { status: 'failed', error: metadata.error };
          } else if (metadata.value?.confirmed) {
            store.updateActivity(activity.id, { metadataCid: metadata.value.cid });
            steps.metadata = ok();
          } else {
            steps.metadata = skipped(metadata.value ? 'not confirmed' : 'nothing to store');
          }
        }

        if (activity.mocked) {
          // A simulated location is anchored like any activity but never earns: a first, client-side check.
          steps.season = skipped('simulated location');
          steps.reward = skipped('simulated location');
        } else {
          const season = await attempt('season contribution', () =>
            chain.recordSeasonContribution(activityHash, activity.distance)
          );
          if (season.ok) {
            steps.season = ok();
          } else if (isConflict(season.error)) {
            // The relayer refuses a repeat with 409: it counted this run, or a timed-out send may still land.
            steps.season = skipped('already counted or being counted');
          } else {
            steps.season = { status: 'failed', error: season.error };
          }

          const reward = await attempt('reward mint', () =>
            chain.mintReward(activityHash, activity.distance)
          );
          if (reward.ok) {
            steps.reward = reward.value.confirmed ? ok() : skipped('not confirmed');
            // Relayed mints can't report the amount; only a known amount is recorded.
            if (reward.value.confirmed && reward.value.amount > 0n) {
              store.updateActivity(activity.id, {
                strdEarned: Number(formatUnits(reward.value.amount, 18)),
              });
            }
          } else {
            steps.reward = { status: 'failed', error: reward.error };
          }
        }
      } else {
        steps.record = { status: 'failed', error: new Error('transaction not confirmed') };
        onchainFailed = true;
      }
    } else {
      steps.record = { status: 'failed', error: record.error };
      onchainFailed = true;
    }

    if (territory && (staysOnDevice(activity.privacy) || activity.hideRoute || activity.mocked)) {
      const why = skipReason(activity);
      steps.territory = skipped(why);
      steps.territoryNft = skipped(why);
    } else if (territory) {
      // A UX-level sybil signal, not a security control: the contract does not enforce it. Unverified users
      // still get their activity and distance recorded; only the territory claim waits.
      if (deps.isVerified()) {
        const polygon = territory;
        const claim = await attempt('claimTerritory', () =>
          chain.claimTerritory(polygon, activity.territoryArea)
        );
        if (!claim.ok) {
          steps.territory = { status: 'failed', error: claim.error };
          steps.territoryNft = skipped('claim failed');
          onchainFailed = true;
        } else if (claim.value.confirmed) {
          steps.territory = ok();
          const nft = await attempt('territory NFT mint', () =>
            chain.mintTerritoryNft(claim.value.territoryId)
          );
          steps.territoryNft = nft.ok ? ok() : { status: 'failed', error: nft.error };
        } else {
          steps.territory = { status: 'failed', error: new Error('transaction not confirmed') };
          steps.territoryNft = skipped('claim not confirmed');
          onchainFailed = true;
        }
      } else {
        needsVerification = true;
        steps.territory = skipped('not verified with World ID');
        steps.territoryNft = skipped('not verified with World ID');
      }
    } else {
      steps.territory = skipped('no territory');
      steps.territoryNft = skipped('no territory');
    }
  }

  return { steps, onchainFailed, needsVerification };
}

/** The outcome of a run that did nothing, every step skipped for the same reason. */
function skippedOutcome(reason: string): OnChainOutcome {
  return {
    steps: {
      record: skipped(reason),
      metadata: skipped(reason),
      season: skipped(reason),
      reward: skipped(reason),
      territory: skipped(reason),
      territoryNft: skipped(reason),
    },
    onchainFailed: false,
    needsVerification: false,
  };
}

/**
 * Tries again to put an activity that is saved on this device onchain. It only acts on one
 * that never got there: recording an activity twice would revert as a duplicate.
 */
export async function retryOnChain(
  activity: Activity,
  deps: Pick<PostRunDeps, 'clock' | 'store' | 'uploader' | 'chain' | 'isVerified'>
): Promise<OnChainOutcome> {
  if (chainProof(activity).state === 'onchain') return skippedOutcome('already onchain');
  if (isSyncing(activity.id)) return skippedOutcome('already syncing');
  return withSyncLock(activity.id, async () => {
    const local = activity.images ?? [];
    const photos =
      !staysOnDevice(activity.privacy) && local.some((uri) => !isPublished(uri))
        ? await uploadPhotos(local, deps)
        : local;
    if (photos.some((uri, i) => uri !== local[i])) {
      deps.store.updateActivity(activity.id, { images: photos });
    }
    return syncOnChain(
      {
        activity: { ...activity, images: photos },
        photos: publishedOnly(photos),
        territory: activity.territory,
      },
      deps
    );
  });
}
