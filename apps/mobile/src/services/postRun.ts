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
  HiddenStat,
  Lap,
  PrivacyZone,
  Ring,
  Split,
} from '@/types';
import type { RewardHold } from '@/types/worldId';
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
  mutedFromFeeds?: boolean;
  hiddenStats?: HiddenStat[];
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

/** What a save is busy with, for the Save button: photos first (when there are any to send), then the rest. */
export type SavePhase = 'uploading-photos' | 'saving';

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
  /** Pause before the one retry of a failed metadata upload; tests pass 0. */
  retryDelayMs?: number;
  /**
   * Runs the moment the activity is stored on this device, before any upload or onchain step. A
   * caller that only needs "it is saved" (a bulk import) stops waiting here and lets the sync finish.
   */
  onSaved?: (activity: Activity) => void;
  /** Told which part of the save is running, so a screen can show it. */
  onProgress?: (phase: SavePhase) => void;
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
  /** From a file or another app; still `isManual` so it never counts toward records. */
  isImported?: boolean;
  /** When the workout began, in ms: for an import, which happened before it was saved. Defaults to now. */
  startedAt?: number;
  /** Trim the route's ends from what gets published (the device keeps it whole). */
  hideRouteEnds?: boolean;
  /** Share the activity without its route map or territory outline (the device keeps both). */
  hideRoute?: boolean;
  /** Keep it out of other athletes' Home feeds (it still shows on the author's profile). */
  mutedFromFeeds?: boolean;
  /** Figures other athletes' apps leave out. */
  hiddenStats?: HiddenStat[];
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
  /** The relayer is holding the reward until this World ID check passes. */
  rewardHold?: RewardHold;
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

const REWARD_HOLDS: readonly RewardHold[] = [
  'enroll_required',
  'presence_required',
  'step_up_required',
];

/** The relayer answers 428 with the World ID check a reward waits for. */
function rewardHoldOf(error: unknown): RewardHold | null {
  if (typeof error !== 'object' || error === null) return null;
  const { status, code } = error as { status?: unknown; code?: unknown };
  return status === 428 && REWARD_HOLDS.includes(code as RewardHold) ? (code as RewardHold) : null;
}

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
    mutedFromFeeds: input.mutedFromFeeds || undefined,
    hiddenStats: input.hiddenStats?.length ? [...input.hiddenStats] : undefined,
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
    isImported: input.isImported || undefined,
    activityHash,
    createdAt: now,
  };

  // Safe on this device first: a crash or a slow upload from here on loses nothing, and the background
  // retry finishes whatever is left. The lock is taken in the same breath, so that retry cannot start
  // while the photos are still going up.
  store.saveActivity(activity);
  deps.timing?.saved(id);
  if (input.territory) store.capturePolygon(deps.userId, input.territory);
  deps.onSaved?.(activity);

  const finished = await withSyncLock(id, async () => {
    const uploading = !staysOnDevice(input.privacy) && !input.photos.every(isPublished);
    if (uploading) deps.onProgress?.('uploading-photos');
    const photos = uploading ? await uploadPhotos(input.photos, deps) : [...input.photos];
    deps.onProgress?.('saving');
    const published = photos.some((uri, index) => uri !== input.photos[index]);
    const current: Activity = published ? { ...activity, images: photos } : activity;
    if (published) store.updateActivity(id, { images: photos });
    const outcome = await syncOnChain(
      { activity: current, photos: publishedOnly(photos), territory: input.territory },
      deps
    );
    return { current, ...outcome };
  });
  const { current, steps, onchainFailed, needsVerification, rewardHold } = finished;

  return { activity: current, needsVerification, onchainFailed, steps, rewardHold };
}

/** What the onchain steps need: the saved activity plus the published form of its photos and territory. */
interface OnChainSubject {
  activity: Activity;
  photos: string[];
  territory: Ring | null;
}

type OnChainOutcome = Pick<
  PostRunResult,
  'steps' | 'onchainFailed' | 'needsVerification' | 'rewardHold'
>;

/**
 * Records a saved activity onchain, as far as it gets. Every step reports its own
 * outcome; one failing never stops the others.
 */
function skipReason(
  activity: Pick<Activity, 'mocked' | 'privacy' | 'hideRoute' | 'hideRouteEnds'>
): string {
  if (activity.mocked) return 'simulated location';
  if (staysOnDevice(activity.privacy)) return 'private activity';
  if (activity.hideRoute) return 'route hidden';
  if (activity.hideRouteEnds) return 'route ends hidden';
  return 'privacy zone';
}

async function syncOnChain(
  { activity, photos, territory }: OnChainSubject,
  deps: Pick<PostRunDeps, 'store' | 'chain' | 'isVerified' | 'timing' | 'retryDelayMs'>
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
  const shared = publicRoute(
    // A hidden route publishes nothing of the route at all.
    activity.hideRoute ? [] : parsePolyline(activity.polyline),
    {
      hideEnds: activity.hideRouteEnds ?? false,
      zones: activity.privacyZones ?? [],
      seed: activity.id,
    }
  );
  const territoryPublic = canShareTerritory(activity, shared.cutByZone);
  let rewardHold: RewardHold | undefined;

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
          const upload = () =>
            chain.setMetadata(onchainActivityId, {
              name: activity.name,
              description: activity.description,
              photos: photos.length > 0 ? photos : undefined,
              polyline: shared.route.length > 0 ? toPolyline(shared.route) : undefined,
              // The loop's outline would point back at a hidden place, so it stays private then.
              territory: territoryPublic ? (territory ?? undefined) : undefined,
              // The chain stores only a hash/distance/duration/area: this is the
              // one durable place the real route shape lives.
              coordinates: shared.route.length > 0 ? shared.route : undefined,
              ...(activity.mutedFromFeeds && { mutedFromFeeds: true }),
              ...(activity.hiddenStats?.length ? { hiddenStats: activity.hiddenStats } : {}),
            });
          // The pinning service sometimes drops the first request after the phone has been idle
          // (seen once on Sepolia: a "fetch failed" after 11 s, then 1-2 s calls); one retry keeps
          // the activity from being saved without its route and photos for that.
          const metadata = await attempt('activity metadata', async () => {
            try {
              return await upload();
            } catch (error) {
              if (isConflict(error)) throw error;
              await new Promise((resolve) => setTimeout(resolve, deps.retryDelayMs ?? 2_000));
              return upload();
            }
          });
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
          const hold = reward.ok ? null : rewardHoldOf(reward.error);
          if (reward.ok) {
            steps.reward = reward.value.confirmed ? ok() : skipped('not confirmed');
            // Relayed mints can't report the amount; only a known amount is recorded.
            if (reward.value.confirmed && reward.value.amount > 0n) {
              store.updateActivity(activity.id, {
                strdEarned: Number(formatUnits(reward.value.amount, 18)),
                rewardHold: undefined,
              });
            }
          } else if (hold) {
            rewardHold = hold;
            store.updateActivity(activity.id, { rewardHold: hold });
            steps.reward = skipped('held for a World ID check');
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

    // The claim writes the outline onchain, so it follows the same privacy rule as the metadata.
    if (territory && (staysOnDevice(activity.privacy) || activity.mocked || !territoryPublic)) {
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

  return { steps, onchainFailed, needsVerification, rewardHold };
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

export type RewardRelease =
  | { status: 'released'; confirmed: boolean }
  | { status: 'held'; hold: RewardHold }
  | { status: 'failed'; error: unknown };

/** Asks the relayer again for a reward it held, once the athlete has passed the World ID check it named. */
export async function releaseHeldReward(
  activity: Activity,
  deps: Pick<PostRunDeps, 'store' | 'chain'>
): Promise<RewardRelease> {
  if (!deps.chain || !activity.activityHash) {
    return { status: 'failed', error: new Error('This activity is not onchain yet.') };
  }
  const activityHash = activity.activityHash as `0x${string}`;
  const reward = await attempt('held reward mint', () =>
    deps.chain!.mintReward(activityHash, activity.distance)
  );
  if (reward.ok) {
    deps.store.updateActivity(activity.id, {
      rewardHold: undefined,
      ...(reward.value.amount > 0n
        ? { strdEarned: Number(formatUnits(reward.value.amount, 18)) }
        : {}),
    });
    return { status: 'released', confirmed: reward.value.confirmed };
  }
  const hold = rewardHoldOf(reward.error);
  if (hold) {
    deps.store.updateActivity(activity.id, { rewardHold: hold });
    return { status: 'held', hold };
  }
  return { status: 'failed', error: reward.error };
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
