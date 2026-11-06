import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type FakePlatform,
  installFakePlatform,
  straightTrack,
  uninstallFakePlatform,
} from '@/platform/fakes';
import { createSensorHub } from '@/services/sensorHub';
import { territoryService } from '@/services/territoryService';
import { createTrackingService } from '@/services/trackingService';
import {
  createTrackingSession,
  type SessionOptions,
  type TrackingSession,
} from '@/services/trackingSession';
import type { PairedSensor } from '@/stores/sensorStore';
import type { Location } from '@/types';

const strap: PairedSensor = { id: 'strap', name: 'Strap', kind: 'heartRate', lastSeen: 0 };
const pedals: PairedSensor = { id: 'pedals', name: 'Pedals', kind: 'power', lastSeen: 0 };

const OPTS: SessionOptions = {
  activityType: 'ride',
  activityLabel: 'Ride',
  accuracyMode: 'best',
  timeIntervalMs: 1000,
  useGyroscope: false,
  autoPause: false,
  sensors: [strap, pedals],
};

let platform: FakePlatform;
let session: TrackingSession;

const ride = () => straightTrack({ speedMps: 8, durationS: 60, intervalS: 2 });

function play(fixes: Location[]): void {
  platform.location.play(fixes, (fix) => platform.clock.set(fix.timestamp));
}

const hr = (bpm: number) => ({ kind: 'heartRate' as const, value: Uint8Array.from([0, bpm]) });
const power = (w: number) => ({
  kind: 'power' as const,
  value: Uint8Array.from([0, 0, w & 0xff, w >> 8]),
});

/** A heart rate and power reading every second for `seconds` of the ride. */
function streamSensors(seconds: number, bpm: number, watts: number): void {
  const start = platform.clock.now();
  for (let s = 0; s < seconds; s++) {
    platform.clock.set(start + s * 1000);
    platform.ble.notify('strap', hr(bpm));
    platform.ble.notify('pedals', power(watts));
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  platform = installFakePlatform();
  const sensors = createSensorHub({
    ble: platform.ble,
    clock: platform.clock,
    wheelMm: () => 2100,
  });
  session = createTrackingSession({
    tracking: createTrackingService(platform),
    territory: territoryService,
    location: platform.location,
    background: platform.background,
    motion: platform.motion,
    haptics: platform.haptics,
    speaker: platform.speaker,
    screenAwake: platform.screenAwake,
    ensureLocationPermission: async () => true,
    clock: platform.clock,
    sensors,
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  uninstallFakePlatform();
});

describe('recording with Bluetooth sensors', () => {
  it('connects the paired sensors at the start and shows their readings', async () => {
    expect(session.getSnapshot().sensors).toBeNull();
    await session.start(OPTS);
    await vi.waitFor(() => expect(platform.ble.isConnected('strap')).toBe(true));
    platform.ble.notify('strap', hr(150));
    platform.ble.notify('pedals', power(230));

    expect(session.getSnapshot().sensors).toMatchObject({
      heartRate: 150,
      power: 230,
      connected: ['heartRate', 'power'],
      lost: [],
    });
  });

  it('records without sensors when none is paired', async () => {
    await session.start({ ...OPTS, sensors: [] });
    expect(platform.ble.calls).toEqual([]);
    expect(session.getSnapshot().sensors).toBeNull();
  });

  it('keeps recording when a sensor drops out and says which one was lost', async () => {
    await session.start(OPTS);
    await vi.waitFor(() => expect(platform.ble.isConnected('strap')).toBe(true));
    platform.ble.drop('strap');

    expect(session.getSnapshot().status).toBe('tracking');
    expect(session.getSnapshot().sensors?.lost).toEqual(['heartRate']);
    expect(session.getSnapshot().sensors?.connected).toEqual(['power']);
  });

  it('saves heart rate and power from the sensors on the activity, and lets go of them', async () => {
    await session.start(OPTS);
    await vi.waitFor(() => expect(platform.ble.isConnected('strap')).toBe(true));
    play(ride());
    streamSensors(30, 150, 220);
    const result = await session.finish();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { summary } = result;
    expect(summary.heartRate).toEqual({ avg: 150, max: 150 });
    expect(summary.avgPower).toBe(220);
    expect(summary.stream?.heartRate?.bpm.length).toBeGreaterThan(20);
    expect(summary.stream?.power?.w[0]).toBe(220);
    expect(summary.recordedWithWatch).toBeUndefined();
    expect(platform.ble.isConnected('strap')).toBe(false);
    expect(session.getSnapshot().sensors).toBeNull();
  });

  it('keeps no readings while paused', async () => {
    await session.start(OPTS);
    await vi.waitFor(() => expect(platform.ble.isConnected('strap')).toBe(true));
    play(ride());
    await session.pause();
    streamSensors(10, 170, 300);
    await session.resume();
    const result = await session.finish();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.heartRate).toBeUndefined();
  });
});
