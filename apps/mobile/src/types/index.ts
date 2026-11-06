import type { ActivityType, Location, Ring, Territory } from '@repo/shared/types';
import type { RewardHold } from './worldId';

export type { ActivityType, Location, Ring, Territory };

export type ActivityFeel = 'great' | 'good' | 'ok' | 'bad' | 'terrible';

export type ActivityEffort = 'easy' | 'moderate' | 'hard' | 'max';

export type ActivityPrivacy = 'everyone' | 'followers' | 'only_me';

/** Figures an author can keep out of what other people's apps show; others still read distance and time. */
export type HiddenStat = 'start_time' | 'pace';

export type Gender = 'man' | 'woman' | 'non_binary' | 'prefer_not_to_say';

export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  birthday: string | null;
  wallet: string;
  ensName?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  followers?: number;
  following?: number;
  isVerified?: boolean;
  createdAt: Date;
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: Date;
  likedBy: string[];
}

export interface Split {
  /** 1-based; the last one may cover less than a full split. */
  index: number;
  distance: number;
  /** Time spent moving, in ms; stops are left out. */
  movingTime: number;
  /** Net metres climbed (negative: descended) over the split; absent without a usable altitude. */
  elevation?: number;
}

export interface Lap {
  index: number;
  /** Meters. */
  distance: number;
  /** Moving time in ms. */
  duration: number;
}

export interface BestEffort {
  /** Meters: 1000, 5000 or 10000. */
  distance: number;
  /** Time spent moving over that stretch, in ms. */
  movingTime: number;
}

/** A place the athlete keeps private: where a published route starts or ends inside it, those points are cut. */
export interface PrivacyZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Meters. */
  radius: number;
}

export type GearKind = 'shoes' | 'bike';

export interface Gear {
  id: string;
  name: string;
  kind: GearKind;
  /** Meters already covered before it was added here. */
  startingDistance: number;
  retired?: boolean;
  /** Parts worn out separately from the item, such as a chain or insoles. */
  components?: GearComponent[];
}

export interface GearComponent {
  id: string;
  name: string;
  /** Epoch ms from which activities on the parent gear count toward this part. */
  installedAt: number;
  /** Meters the part is meant to last; at least one budget is set. */
  budgetDistance?: number;
  /** Moving time (ms) the part is meant to last. */
  budgetTime?: number;
}

/** Speed over time for a recording; kept on this device, never published. */
export interface ActivityStream {
  /** Seconds since the first fix, ascending. */
  t: number[];
  /** Metres per second at each `t`. */
  speed: number[];
  /** Metres covered by each `t`; absent in streams saved before this was kept. */
  d?: number[];
  /** When the first fix arrived, in ms since 1970; absent in streams saved before this was kept. */
  startedAt?: number;
  /** Heart rate readings from a watch or band: seconds since the start and bpm at each. */
  heartRate?: { t: number[]; bpm: number[] };
  /** Metres above sea level at each `t`; absent when the phone gave no usable altitude. */
  alt?: number[];
  /** Pedometer cadence per second since the first step sample; absent while motion sensors are off. */
  cadence?: { t: number[]; spm: number[] };
  /** Running or cycling power from a watch: seconds since the start and watts at each. */
  power?: { t: number[]; w: number[] };
}

export interface Activity {
  id: string;
  userId: string;
  name?: string;
  activityType: ActivityType;
  distance: number;
  duration: number;
  polyline: string;
  /** Per-kilometre (or per-mile) times from the recording; absent for manual entries and older runs. */
  splits?: Split[];
  /** Speed over time for the pace curve; absent for manual entries and older runs. */
  stream?: ActivityStream;
  gearId?: string;
  /** Fastest 1 km / 5 km / 10 km within the recording; absent for manual entries and older runs. */
  bestEfforts?: BestEffort[];
  /** The route published for others had its first and last stretch left out; kept so an edit republishes it the same way. */
  hideRouteEnds?: boolean;
  /** Shared without its route map or territory outline; this device keeps both. */
  hideRoute?: boolean;
  /** Left out of other athletes' Home feeds; still on the author's profile and own feed. Published with the activity, honoured by the app, not enforced by the chain. */
  mutedFromFeeds?: boolean;
  /** Figures other athletes' apps leave out of this activity; the owner always sees everything. */
  hiddenStats?: HiddenStat[];
  /** Recorded with a simulated location: anchored, but never counts for rewards, territory or records. */
  mocked?: boolean;
  /** The athlete's privacy zones when this was saved; a later edit republishes the route cut the same way. */
  privacyZones?: PrivacyZone[];
  /** Laps marked during the recording; absent when none were, and for manual entries. */
  laps?: Lap[];
  /** The polygon enclosed by this run, or null if the route never closed a loop. */
  territory: Ring | null;
  /** Area of `territory` in square meters, 0 when there's no territory. */
  territoryArea: number;
  activityHash?: string;
  elevationGain?: number;
  /** Metres descended, worked out from the recording's own altitude; absent for older activities. */
  elevationLoss?: number;
  /** Average and highest heart rate (bpm), from a watch or band; absent when none was recorded. */
  heartRate?: { avg: number; max: number };
  /** Calories as the watch measured them (kcal); preferred over the estimate. */
  caloriesBurned?: number;
  /** Average running or cycling power (watts), when a watch measured it. */
  avgPower?: number;
  /** Recorded with an Apple Watch streaming its heart rate, distance and cadence live. */
  recordedWithWatch?: boolean;
  image?: string;
  images?: string[];
  description?: string;
  feel?: ActivityFeel;
  /** How hard it felt; kept on this device. */
  effort?: ActivityEffort;
  isCommute?: boolean;
  /** A note only the athlete sees; kept on this device, never published. */
  privateNote?: string;
  privacy?: ActivityPrivacy;
  isManual?: boolean;
  /** Brought in from a GPX/TCX file or Health Connect rather than recorded or typed here. */
  isImported?: boolean;
  kudos?: string[];
  comments?: Comment[];
  txHash?: string;
  /** STRD tokens earned for this activity's distance, once the mint confirms. */
  strdEarned?: number;
  /** The reward is held until this World ID check passes; the run itself is saved and onchain. */
  rewardHold?: RewardHold;
  /** Decimal string: bigint does not survive AsyncStorage's JSON persistence. */
  onchainActivityId?: string;
  /** IPFS CID of the off-chain metadata once attached on-chain; skips re-upload and lets other devices resolve it. */
  metadataCid?: string;
  /** Wearable heart-rate check for this activity (Health Connect / HealthKit). */
  sweat?: {
    score: number;
    avgBpm: number;
    maxBpm: number;
    sampleCount: number;
    verified: boolean;
    reason: string;
  };
  steps?: number;
  /** Segment efforts written to Arkiv for this activity. */
  segmentEfforts?: Array<{
    key: string;
    segmentKey: string;
    segmentName: string;
    elapsedSec: number;
  }>;
  /** Swarm reference of the archived GPX (sealed when the route is private). */
  swarmRef?: string;
  swarmLink?: string;
  /** Arkiv `stryde_route_archive` entity that points at the Swarm GPX. */
  swarmArchiveKey?: string;
  /** Automatic retry bookkeeping for an activity the chain does not hold yet. */
  sync?: { attempts: number; nextAttemptAt: number; lastError?: string };
  createdAt: Date;
}
