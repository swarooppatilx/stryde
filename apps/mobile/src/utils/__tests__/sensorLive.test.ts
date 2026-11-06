import { describe, expect, it } from 'vitest';
import type { BleDevice } from '@/platform/ports';
import {
  groupByKind,
  isStale,
  liveSensors,
  MAX_RECONNECT_ATTEMPTS,
  newlyLost,
  readingText,
  reconnectDelay,
  SENSOR_STALE_MS,
  type SensorLink,
  sensorsSubtitle,
  signalBars,
} from '@/utils/sensorLive';

describe('isStale', () => {
  it('treats a reading that never came as stale', () => {
    expect(isStale(null, 1000)).toBe(true);
    expect(isStale(undefined, 1000)).toBe(true);
  });

  it('keeps a reading fresh until the timeout has passed', () => {
    expect(isStale(1000, 1000 + SENSOR_STALE_MS)).toBe(false);
    expect(isStale(1000, 1000 + SENSOR_STALE_MS + 1)).toBe(true);
  });

  it('accepts a custom timeout and a clock that moved back', () => {
    expect(isStale(1000, 1500, 400)).toBe(true);
    expect(isStale(5000, 4000)).toBe(false);
  });
});

describe('reconnectDelay', () => {
  it('backs off and stays bounded', () => {
    expect(reconnectDelay(0)).toBe(1000);
    expect(reconnectDelay(1)).toBe(2000);
    expect(reconnectDelay(2)).toBe(4000);
    expect(reconnectDelay(MAX_RECONNECT_ATTEMPTS - 1)).toBe(30_000);
  });

  it('gives up after the last attempt', () => {
    expect(reconnectDelay(MAX_RECONNECT_ATTEMPTS)).toBeNull();
    expect(reconnectDelay(-1)).toBeNull();
  });
});

const link = (patch: Partial<SensorLink>): SensorLink => ({
  id: 'a',
  name: 'Strap',
  kinds: ['heartRate'],
  status: 'connected',
  everConnected: true,
  ...patch,
});

describe('liveSensors', () => {
  const latest = {
    heartRate: { value: 140, at: 10_000 },
    power: { value: 200, at: 1_000 },
  };

  it('drops readings that went stale and keeps fresh ones', () => {
    const live = liveSensors(latest, [link({})], 10_500);
    expect(live.heartRate).toBe(140);
    expect(live.power).toBeUndefined();
  });

  it('lists connected and lost kinds', () => {
    const live = liveSensors(
      latest,
      [
        link({}),
        link({ id: 'p', kinds: ['power'], status: 'reconnecting' }),
        link({ id: 'c', kinds: ['speedCadence'], status: 'connecting', everConnected: false }),
      ],
      10_500
    );
    expect(live.connected).toEqual(['heartRate']);
    expect(live.lost).toEqual(['power']);
  });

  it('counts a sensor that gave up as lost', () => {
    expect(liveSensors({}, [link({ status: 'lost' })], 0).lost).toEqual(['heartRate']);
  });
});

describe('newlyLost', () => {
  it('reports only kinds that were not lost before', () => {
    expect(newlyLost([], ['heartRate'])).toEqual(['heartRate']);
    expect(newlyLost(['heartRate'], ['heartRate', 'power'])).toEqual(['power']);
    expect(newlyLost(['heartRate'], [])).toEqual([]);
  });
});

describe('sensorsSubtitle', () => {
  it('says how many are connected, or paired, or none', () => {
    expect(sensorsSubtitle({ connected: 1, paired: 2 })).toBe('1 connected');
    expect(sensorsSubtitle({ connected: 0, paired: 2 })).toBe('2 paired');
    expect(sensorsSubtitle({ connected: 0, paired: 0 })).toBe('None');
  });
});

describe('signalBars', () => {
  it('maps signal strength to 0 to 4 bars', () => {
    expect(signalBars(-45)).toBe(4);
    expect(signalBars(-65)).toBe(3);
    expect(signalBars(-78)).toBe(2);
    expect(signalBars(-90)).toBe(1);
    expect(signalBars(null)).toBe(0);
  });
});

describe('groupByKind', () => {
  const device = (id: string, kinds: BleDevice['kinds'], rssi: number | null): BleDevice => ({
    id,
    name: id,
    kinds,
    rssi,
  });

  it('lists a device under each kind it offers, strongest first', () => {
    const groups = groupByKind([
      device('weak', ['heartRate'], -90),
      device('strong', ['heartRate'], -50),
      device('pedals', ['power', 'speedCadence'], -60),
      device('quiet', ['speedCadence'], null),
    ]);
    expect(groups.map((g) => g.kind)).toEqual(['heartRate', 'power', 'speedCadence']);
    expect(groups[0]?.devices.map((d) => d.id)).toEqual(['strong', 'weak']);
    expect(groups[2]?.devices.map((d) => d.id)).toEqual(['pedals', 'quiet']);
  });

  it('leaves out kinds with nothing found', () => {
    expect(groupByKind([device('a', ['power'], -50)]).map((g) => g.kind)).toEqual(['power']);
    expect(groupByKind([])).toEqual([]);
  });
});

describe('readingText', () => {
  const live = { heartRate: 141.6, power: 230, cadence: 88, speed: 10, connected: [], lost: [] };

  it('words the latest reading for each kind', () => {
    expect(readingText('heartRate', live, 'metric')).toBe('142 bpm');
    expect(readingText('power', live, 'metric')).toBe('230 W');
    expect(readingText('speedCadence', live, 'metric')).toBe('36 km/h · 88 rpm');
    expect(readingText('speedCadence', live, 'imperial')).toBe('22 mph · 88 rpm');
  });

  it('leaves out what is missing and returns null when there is nothing', () => {
    expect(readingText('speedCadence', { ...live, speed: undefined }, 'metric')).toBe('88 rpm');
    expect(readingText('heartRate', { connected: [], lost: [] }, 'metric')).toBeNull();
  });
});
