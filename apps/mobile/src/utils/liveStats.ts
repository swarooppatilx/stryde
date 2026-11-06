import type { Ionicons } from '@expo/vector-icons';
import type { LiveWatch } from '@/services/watchRecording';
import type { ActivityType, Lap, Split } from '@/types';
import {
  formatArea,
  formatClock,
  formatDistance,
  formatElevation,
  formatPace,
  formatSpeed,
  paceLabel,
  showsSpeed,
  type UnitSystem,
} from '@/utils/format';
import { type ZoneFloors, zoneOf } from '@/utils/heartRateZones';
import type { LiveSensors } from '@/utils/sensorLive';

/** Sports read in pace share one layout, sports read in speed (rides, skates) another. */
export type LiveStatFamily = 'pace' | 'speed';

/** Three big figures, then three more on the row that expands. */
export const LIVE_STAT_SLOT_COUNT = 6;
export const PRIMARY_LIVE_STAT_SLOTS = 3;

/** What the recording knows at this moment; every field is worked out from this alone. */
export interface LiveStatData {
  distance: number;
  /** Moving time in ms. */
  duration: number;
  /** Movement over the last few seconds, for the "right now" figure. */
  recent: { distance: number; durationMs: number };
  /** Area enclosed so far; null until the route closes into a loop. */
  territoryArea: number | null;
  /** Metres climbed; null while the phone gives no usable altitude. */
  elevationGain: number | null;
  lapCount: number;
  lastLap: Lap | null;
  /** Every lap closed so far, oldest first. */
  laps: readonly Lap[];
  splits: readonly Split[];
  /** Milliseconds since the last GPS fix; null while none has arrived. */
  fixAgeMs: number | null;
  /** Metres above sea level at the last fix; null when the phone gave none. */
  altitude: number | null;
  /** The stretch since Lap was last pressed (or since the start). Moving time in ms. */
  currentLap: { distance: number; duration: number };
  /** The Apple Watch's latest readings; absent when no watch is recording. */
  watch?: LiveWatch | null;
  /** Bluetooth sensors' latest readings; they win over the watch. Absent when none are connected. */
  sensors?: LiveSensors | null;
  /** What the athlete's heart rate zones are measured against; null while no maximum is known. */
  hrProfile?: HeartRateProfile | null;
}

export interface HeartRateProfile {
  maxHr: number;
  restingHr?: number;
  floors?: ZoneFloors;
}

/** A GPS speed older than this no longer says how fast the athlete is moving. */
export const STALE_SPEED_MS = 3000;
/** Any other sensor reading older than this is shown as a dash. */
export const STALE_SENSOR_MS = 5000;

export type LiveStatId =
  | 'time'
  | 'distance'
  | 'avgPace'
  | 'avgSpeed'
  | 'currentPace'
  | 'currentSpeed'
  | 'lastSplitPace'
  | 'lastSplitSpeed'
  | 'lastLapPace'
  | 'lastLapSpeed'
  | 'territory'
  | 'climb'
  | 'elevation'
  | 'lapTime'
  | 'lapDistance'
  | 'lapPace'
  | 'lapSpeed'
  | 'laps'
  | 'heartRate'
  | 'heartRateZone'
  | 'cadence'
  | 'power'
  | 'calories';

export interface LiveStatField {
  id: LiveStatId;
  /** What the picker and screen readers call it. */
  name: string;
  /** The caption under the figure. */
  label(unitSystem: UnitSystem): string;
  icon: keyof typeof Ionicons.glyphMap;
  families: readonly LiveStatFamily[];
  value(data: LiveStatData, unitSystem: UnitSystem): string;
  /** False while the data behind it has not come at all; the expanding row then leaves it out. */
  available?(data: LiveStatData): boolean;
  /** Set when the figure is good news worth colouring. */
  tone?(data: LiveStatData): 'success' | undefined;
}

const DASH = '—';
const BOTH: readonly LiveStatFamily[] = ['pace', 'speed'];
const PACE: readonly LiveStatFamily[] = ['pace'];
const SPEED: readonly LiveStatFamily[] = ['speed'];

const finite = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n);

/** A broken reading (NaN, Infinity) is shown as a dash rather than passed to a formatter. */
function pace(distance: number, durationMs: number, unitSystem: UnitSystem): string {
  return finite(distance) && finite(durationMs)
    ? formatPace(distance, durationMs, unitSystem)
    : DASH;
}

function speed(distance: number, durationMs: number, unitSystem: UnitSystem): string {
  return finite(distance) && finite(durationMs)
    ? formatSpeed(distance, durationMs, unitSystem)
    : DASH;
}

const speedStale = (d: LiveStatData) => d.fixAgeMs !== null && d.fixAgeMs > STALE_SPEED_MS;
const sensorStale = (d: LiveStatData) => d.fixAgeMs === null || d.fixAgeMs > STALE_SENSOR_MS;

const speedUnit = (unitSystem: UnitSystem) => (unitSystem === 'imperial' ? 'mph' : 'km/h');
const splitLabel = (unitSystem: UnitSystem) => (unitSystem === 'imperial' ? 'Last mi' : 'Last km');
const lastSplit = (data: LiveStatData) => data.splits.at(-1);
/** A watch reading rounded with its unit, or a dash while the watch has none (or dropped out). */
const watchFigure = (value: number | undefined, unit: string) =>
  finite(value) ? `${Math.round(value)} ${unit}` : DASH;

/** Heart rate, power and cadence come from a Bluetooth sensor first, then the watch. */
const heartRateOf = (d: LiveStatData) => d.sensors?.heartRate ?? d.watch?.heartRate;
const powerOf = (d: LiveStatData) => d.sensors?.power ?? d.watch?.power;
const cadenceOf = (d: LiveStatData) => d.sensors?.cadence ?? d.watch?.cadence;
const hasSensor = (d: LiveStatData, kind: 'heartRate' | 'power' | 'speedCadence') =>
  d.sensors?.connected.includes(kind) === true;

export const LIVE_STAT_FIELDS: Readonly<Record<LiveStatId, LiveStatField>> = {
  time: {
    id: 'time',
    name: 'Time',
    label: () => 'Time',
    icon: 'time-outline',
    families: BOTH,
    value: (d) => (finite(d.duration) ? formatClock(d.duration) : DASH),
  },
  distance: {
    id: 'distance',
    name: 'Distance',
    label: () => 'Distance',
    icon: 'navigate-outline',
    families: BOTH,
    value: (d, u) => (finite(d.distance) ? formatDistance(d.distance, u) : DASH),
  },
  avgPace: {
    id: 'avgPace',
    name: 'Average pace',
    label: (u) => `Avg ${paceLabel(u)}`,
    icon: 'stopwatch-outline',
    families: PACE,
    value: (d, u) => pace(d.distance, d.duration, u),
  },
  avgSpeed: {
    id: 'avgSpeed',
    name: 'Average speed',
    label: (u) => `Avg Speed ${speedUnit(u)}`,
    icon: 'stopwatch-outline',
    families: SPEED,
    value: (d, u) => speed(d.distance, d.duration, u),
  },
  currentPace: {
    id: 'currentPace',
    name: 'Current pace',
    label: () => 'Right now',
    icon: 'speedometer',
    families: PACE,
    value: (d, u) => (speedStale(d) ? DASH : pace(d.recent.distance, d.recent.durationMs, u)),
  },
  currentSpeed: {
    id: 'currentSpeed',
    name: 'Current speed',
    label: () => 'Right now',
    icon: 'speedometer',
    families: SPEED,
    value: (d, u) => {
      const sensorSpeed = d.sensors?.speed;
      if (finite(sensorSpeed)) return speed(sensorSpeed, 1000, u);
      return finite(d.recent.distance) && finite(d.recent.durationMs) && speedStale(d)
        ? `0 ${speedUnit(u)}`
        : speed(d.recent.distance, d.recent.durationMs, u);
    },
  },
  lastSplitPace: {
    id: 'lastSplitPace',
    name: 'Last split pace',
    label: splitLabel,
    icon: 'git-commit-outline',
    families: PACE,
    value: (d, u) => {
      const split = lastSplit(d);
      return split ? pace(split.distance, split.movingTime, u) : DASH;
    },
  },
  lastSplitSpeed: {
    id: 'lastSplitSpeed',
    name: 'Last split speed',
    label: splitLabel,
    icon: 'git-commit-outline',
    families: SPEED,
    value: (d, u) => {
      const split = lastSplit(d);
      return split ? speed(split.distance, split.movingTime, u) : DASH;
    },
  },
  lastLapPace: {
    id: 'lastLapPace',
    name: 'Last lap pace',
    label: () => 'Last lap',
    icon: 'flag-outline',
    families: PACE,
    value: (d, u) => (d.lastLap ? pace(d.lastLap.distance, d.lastLap.duration, u) : DASH),
  },
  lastLapSpeed: {
    id: 'lastLapSpeed',
    name: 'Last lap speed',
    label: () => 'Last lap',
    icon: 'flag-outline',
    families: SPEED,
    value: (d, u) => (d.lastLap ? speed(d.lastLap.distance, d.lastLap.duration, u) : DASH),
  },
  territory: {
    id: 'territory',
    name: 'Territory',
    label: () => 'Territory',
    icon: 'shield-checkmark',
    families: BOTH,
    value: (d, u) => (finite(d.territoryArea) ? formatArea(d.territoryArea, u) : DASH),
    tone: (d) => (finite(d.territoryArea) ? 'success' : undefined),
  },
  climb: {
    id: 'climb',
    name: 'Elevation gain',
    label: () => 'Climb',
    icon: 'trending-up',
    families: BOTH,
    value: (d, u) => (finite(d.elevationGain) ? formatElevation(d.elevationGain, u) : DASH),
    available: (d) => d.elevationGain !== null,
  },
  elevation: {
    id: 'elevation',
    name: 'Elevation',
    label: () => 'Elevation',
    icon: 'analytics-outline',
    families: BOTH,
    value: (d, u) =>
      finite(d.altitude) && !sensorStale(d) ? formatElevation(d.altitude, u) : DASH,
    available: (d) => d.altitude !== null,
  },
  lapTime: {
    id: 'lapTime',
    name: 'Lap time',
    label: () => 'Lap time',
    icon: 'flag-outline',
    families: BOTH,
    value: (d) => (finite(d.currentLap.duration) ? formatClock(d.currentLap.duration) : DASH),
  },
  lapDistance: {
    id: 'lapDistance',
    name: 'Lap distance',
    label: () => 'Lap distance',
    icon: 'flag-outline',
    families: BOTH,
    value: (d, u) =>
      finite(d.currentLap.distance) ? formatDistance(d.currentLap.distance, u) : DASH,
  },
  lapPace: {
    id: 'lapPace',
    name: 'Lap pace',
    label: (u) => `Lap ${paceLabel(u)}`,
    icon: 'flag-outline',
    families: PACE,
    value: (d, u) => pace(d.currentLap.distance, d.currentLap.duration, u),
  },
  lapSpeed: {
    id: 'lapSpeed',
    name: 'Lap speed',
    label: (u) => `Lap Speed ${speedUnit(u)}`,
    icon: 'flag-outline',
    families: SPEED,
    value: (d, u) => speed(d.currentLap.distance, d.currentLap.duration, u),
  },
  laps: {
    id: 'laps',
    name: 'Laps',
    label: () => 'Laps',
    icon: 'repeat',
    families: BOTH,
    value: (d) => (finite(d.lapCount) ? String(d.lapCount) : DASH),
  },
  heartRate: {
    id: 'heartRate',
    name: 'Heart rate',
    label: () => 'Heart rate',
    icon: 'heart',
    families: BOTH,
    value: (d) => watchFigure(heartRateOf(d), 'bpm'),
    available: (d) => heartRateOf(d) !== undefined || hasSensor(d, 'heartRate'),
  },
  heartRateZone: {
    id: 'heartRateZone',
    name: 'Heart rate zone',
    label: () => 'HR zone',
    icon: 'pulse-outline',
    families: BOTH,
    value: (d) => {
      const bpm = heartRateOf(d);
      if (!finite(bpm) || !d.hrProfile) return DASH;
      const { maxHr, restingHr, floors } = d.hrProfile;
      return `Zone ${zoneOf(bpm, maxHr, restingHr, floors)}`;
    },
    available: (d) => heartRateOf(d) !== undefined && Boolean(d.hrProfile),
  },
  cadence: {
    id: 'cadence',
    name: 'Cadence',
    label: () => 'Cadence',
    icon: 'footsteps-outline',
    families: BOTH,
    value: (d) => watchFigure(cadenceOf(d), d.sensors?.cadence === undefined ? 'spm' : 'rpm'),
    available: (d) => cadenceOf(d) !== undefined || hasSensor(d, 'speedCadence'),
  },
  power: {
    id: 'power',
    name: 'Power',
    label: () => 'Power',
    icon: 'flash-outline',
    families: BOTH,
    value: (d) => watchFigure(powerOf(d), 'W'),
    available: (d) => powerOf(d) !== undefined || hasSensor(d, 'power'),
  },
  calories: {
    id: 'calories',
    name: 'Calories',
    label: () => 'Calories',
    icon: 'flame-outline',
    families: BOTH,
    value: (d) => watchFigure(d.watch?.calories, 'kcal'),
    available: (d) => d.watch?.calories !== undefined,
  },
};

/** The layout saved per family: one field id per slot, read back from storage so possibly stale. */
export type LiveStatSlots = Record<LiveStatFamily, readonly LiveStatId[]>;

/** Default layout: time, average and distance; then territory, right now and climb. */
export const DEFAULT_LIVE_STAT_SLOTS: LiveStatSlots = {
  pace: ['time', 'avgPace', 'distance', 'territory', 'currentPace', 'climb'],
  speed: ['time', 'avgSpeed', 'distance', 'territory', 'currentSpeed', 'climb'],
};

export function liveStatFamily(activityType: ActivityType): LiveStatFamily {
  return showsSpeed(activityType) ? 'speed' : 'pace';
}

/** The fields the picker offers for this family, in catalogue order. */
export function liveStatChoices(family: LiveStatFamily): LiveStatField[] {
  return Object.values(LIVE_STAT_FIELDS).filter((f) => f.families.includes(family));
}

// A set rather than `in`: inherited keys such as "toString" must not pass as fields.
const LIVE_STAT_IDS: ReadonlySet<string> = new Set(Object.keys(LIVE_STAT_FIELDS));

function suits(id: unknown, family: LiveStatFamily): id is LiveStatId {
  return (
    typeof id === 'string' &&
    LIVE_STAT_IDS.has(id) &&
    LIVE_STAT_FIELDS[id as LiveStatId].families.includes(family)
  );
}

/**
 * The field in each slot for this family. A saved id that is unknown (a field since removed) or
 * belongs to the other family puts that slot back to its default, so a bad entry costs one slot,
 * not the athlete's whole layout.
 */
export function resolveLiveStatLayout(family: LiveStatFamily, saved: unknown): LiveStatId[] {
  const list: readonly unknown[] = Array.isArray(saved) ? saved : [];
  return DEFAULT_LIVE_STAT_SLOTS[family].map((fallback, slot) => {
    const id = list[slot];
    return suits(id, family) ? id : fallback;
  });
}

/** Saved settings of any shape turned into a full, valid layout for every family. */
export function sanitizeLiveStatSlots(saved: unknown): LiveStatSlots {
  const record =
    typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>) : {};
  return {
    pace: resolveLiveStatLayout('pace', record.pace),
    speed: resolveLiveStatLayout('speed', record.speed),
  };
}

/**
 * Puts a field in a slot. If another slot already shows it the two swap, so no figure is shown
 * twice. An unsuitable field or a slot that does not exist changes nothing.
 */
export function withLiveStatSlot(
  slots: LiveStatSlots,
  family: LiveStatFamily,
  slot: number,
  id: LiveStatId
): LiveStatSlots {
  if (!suits(id, family) || !Number.isInteger(slot) || slot < 0 || slot >= LIVE_STAT_SLOT_COUNT) {
    return slots;
  }
  const layout = resolveLiveStatLayout(family, slots[family]);
  const previous = layout[slot];
  const other = layout.indexOf(id);
  if (previous === undefined) return slots;
  if (other !== -1) layout[other] = previous;
  layout[slot] = id;
  return { ...slots, [family]: layout };
}
