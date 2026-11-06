import type { BleDevice, SensorKind } from '@/platform/ports';
import { formatSpeed, type UnitSystem } from '@/utils/format';

/** A sensor reading older than this is dropped rather than shown as if it were live. */
export const SENSOR_STALE_MS = 6000;

export function isStale(
  lastAt: number | null | undefined,
  now: number,
  timeoutMs: number = SENSOR_STALE_MS
): boolean {
  if (lastAt === null || lastAt === undefined) return true;
  return now - lastAt > timeoutMs;
}

export const MAX_RECONNECT_ATTEMPTS = 10;
const FIRST_RECONNECT_MS = 1000;
const LONGEST_RECONNECT_MS = 30_000;

/** Wait before reconnect attempt `attempt` (0 first); doubles up to 30 s, then null once it is time to give up. */
export function reconnectDelay(attempt: number): number | null {
  if (attempt < 0 || attempt >= MAX_RECONNECT_ATTEMPTS) return null;
  return Math.min(FIRST_RECONNECT_MS * 2 ** attempt, LONGEST_RECONNECT_MS);
}

export type SensorLinkStatus = 'connecting' | 'connected' | 'reconnecting' | 'lost';

export interface SensorLink {
  id: string;
  name: string;
  kinds: SensorKind[];
  status: SensorLinkStatus;
  /** Whether it was ever connected: a first connection still pending is not a loss. */
  everConnected: boolean;
}

export type ReadingField = 'heartRate' | 'power' | 'cadence' | 'speed';
export type LatestReadings = Partial<Record<ReadingField, { value: number; at: number }>>;

/** What the recording shows from the sensors right now. Speed is metres per second, cadence revolutions per minute. */
export interface LiveSensors {
  heartRate?: number;
  power?: number;
  cadence?: number;
  speed?: number;
  connected: SensorKind[];
  /** Sensors that were connected and dropped out (still reconnecting, or given up). */
  lost: SensorKind[];
}

export function liveSensors(
  latest: LatestReadings,
  links: readonly SensorLink[],
  now: number
): LiveSensors {
  const live: LiveSensors = { connected: [], lost: [] };
  for (const field of ['heartRate', 'power', 'cadence', 'speed'] as const) {
    const reading = latest[field];
    if (reading && !isStale(reading.at, now)) live[field] = reading.value;
  }
  for (const link of links) {
    if (link.status === 'connected') live.connected.push(...link.kinds);
    else if (link.everConnected) live.lost.push(...link.kinds);
  }
  return live;
}

/** The kinds in `next` that were not already in `before`: a loss is announced once. */
export function newlyLost(
  before: readonly SensorKind[],
  next: readonly SensorKind[]
): SensorKind[] {
  return next.filter((kind) => !before.includes(kind));
}

export function sensorsSubtitle({
  connected,
  paired,
}: {
  connected: number;
  paired: number;
}): string {
  if (connected > 0) return `${connected} connected`;
  if (paired > 0) return `${paired} paired`;
  return 'None';
}

/** Signal strength in dBm as 0 (unknown) to 4 bars. */
export function signalBars(rssi: number | null): 0 | 1 | 2 | 3 | 4 {
  if (rssi === null) return 0;
  if (rssi >= -55) return 4;
  if (rssi >= -70) return 3;
  if (rssi >= -85) return 2;
  return 1;
}

export const SENSOR_KIND_ORDER: readonly SensorKind[] = ['heartRate', 'power', 'speedCadence'];

export const SENSOR_KIND_LABEL: Record<SensorKind, string> = {
  heartRate: 'Heart rate',
  power: 'Power',
  speedCadence: 'Speed and cadence',
};

export interface SensorGroup {
  kind: SensorKind;
  devices: BleDevice[];
}

/** Scan results under each kind they offer (a device may appear in several), strongest signal first. */
export function groupByKind(devices: readonly BleDevice[]): SensorGroup[] {
  const strength = (d: BleDevice) => d.rssi ?? Number.NEGATIVE_INFINITY;
  return SENSOR_KIND_ORDER.map((kind) => ({
    kind,
    devices: devices
      .filter((d) => d.kinds.includes(kind))
      .sort((a, b) => strength(b) - strength(a)),
  })).filter((group) => group.devices.length > 0);
}

/** The latest reading a kind of sensor gives, worded for a preview; null while it has none. */
export function readingText(
  kind: SensorKind,
  live: LiveSensors,
  unitSystem: UnitSystem
): string | null {
  if (kind === 'heartRate') {
    return live.heartRate === undefined ? null : `${Math.round(live.heartRate)} bpm`;
  }
  if (kind === 'power') return live.power === undefined ? null : `${Math.round(live.power)} W`;
  const parts: string[] = [];
  if (live.speed !== undefined) parts.push(formatSpeed(live.speed, 1000, unitSystem));
  if (live.cadence !== undefined) parts.push(`${Math.round(live.cadence)} rpm`);
  return parts.length > 0 ? parts.join(' · ') : null;
}
