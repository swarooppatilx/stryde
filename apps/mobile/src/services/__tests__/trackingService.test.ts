import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Location } from '@/types';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

// motionSensorService pulls in expo-sensors, which can't be imported outside
// a native runtime (vitest node env).
vi.mock('../motionSensorService', () => ({
  motionSensorService: {
    getStepCount: () => 0,
    getHeading: () => 0,
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackingService } from '../trackingService';

const service = TrackingService.getInstance();

const TRACKING_KEY = '@stryde/tracking';
const BASE_MS = new Date('2026-01-01T00:00:00.000Z').getTime();
const METERS_PER_DEG = 111320;
const LAT = 48.85;
const LNG = 2.294;

function latOffset(meters: number): number {
  return meters / METERS_PER_DEG;
}

function loc(timestampOffset: number, latitude: number, longitude: number): Location {
  return { latitude, longitude, timestamp: BASE_MS + timestampOffset, accuracy: 5 };
}

function feed(...locations: Location[]): void {
  for (const location of locations) {
    vi.setSystemTime(BASE_MS + (location.timestamp - BASE_MS));
    service.addLocation(location);
  }
}

function feedSlowUntilPaused(): void {
  for (let i = 0; i <= 6; i++) {
    feed(loc(i * 1000, LAT, LNG));
  }
}

function lastPersisted(): string | undefined {
  const calls = vi.mocked(AsyncStorage.setItem).mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    if (calls[i][0] === TRACKING_KEY) return calls[i][1];
  }
  return undefined;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(BASE_MS);
  vi.clearAllMocks();
  service.setAutoPauseEnabled(true);
  service.setUseGyroscope(false);
  await service.startTracking();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TrackingService auto-pause', () => {
  it('never pauses while moving at >= 1 m/s', () => {
    const pauseSpy = vi.spyOn(service, 'pauseTracking');
    const fixes: Location[] = [];
    for (let i = 0; i < 10; i++) {
      fixes.push(loc(i * 1000, LAT + i * latOffset(5), LNG));
    }
    feed(...fixes);

    expect(pauseSpy).not.toHaveBeenCalled();
    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });

  it('pauses after ~5s of consecutive fixes below 1 m/s', () => {
    const pauseSpy = vi.spyOn(service, 'pauseTracking');
    feedSlowUntilPaused();

    expect(pauseSpy).toHaveBeenCalled();
    expect(service.getIsAutoPaused()).toBe(true);
    expect(service.getIsTracking()).toBe(false);
  });

  it('does not pause on a single sub-1 m/s blip', () => {
    const pauseSpy = vi.spyOn(service, 'pauseTracking');
    for (let i = 0; i < 4; i++) {
      feed(loc(i * 1000, LAT + i * latOffset(5), LNG));
    }
    feed(loc(4 * 1000, LAT + 3 * latOffset(5), LNG));
    for (let i = 5; i < 10; i++) {
      feed(loc(i * 1000, LAT + i * latOffset(5), LNG));
    }

    expect(pauseSpy).not.toHaveBeenCalled();
    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });

  it('does not pause while disabled, and disabling aborts an in-progress hold', () => {
    const pauseSpy = vi.spyOn(service, 'pauseTracking');
    feed(loc(0, LAT, LNG), loc(1000, LAT, LNG), loc(2000, LAT, LNG));

    service.setAutoPauseEnabled(false);

    for (let i = 3; i <= 12; i++) {
      feed(loc(i * 1000, LAT, LNG));
    }

    expect(pauseSpy).not.toHaveBeenCalled();
    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });

  it('freezes duration while auto-paused', () => {
    feedSlowUntilPaused();
    expect(service.getIsAutoPaused()).toBe(true);

    const atPause = service.getDuration();
    vi.setSystemTime(BASE_MS + 30_000);

    expect(service.getDuration()).toBe(atPause);
  });

  it('resumes only when speed > 1 m/s and displacement >= 2m', () => {
    feedSlowUntilPaused();
    expect(service.getIsAutoPaused()).toBe(true);

    feed(loc(6500, LAT + latOffset(1.5), LNG));
    expect(service.getIsAutoPaused()).toBe(true);
    expect(service.getIsTracking()).toBe(false);

    feed(loc(7000, LAT + latOffset(3), LNG));
    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });

  it('stays paused on high speed but < 2m displacement', () => {
    feedSlowUntilPaused();
    expect(service.getIsAutoPaused()).toBe(true);

    feed(loc(6500, LAT + latOffset(1.8), LNG));
    expect(service.getIsAutoPaused()).toBe(true);
    expect(service.getIsTracking()).toBe(false);
  });

  it('manual resume wins over auto-pause', async () => {
    feedSlowUntilPaused();
    expect(service.getIsAutoPaused()).toBe(true);

    await service.resumeTracking();

    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });

  it('manual pause clears auto-pause state', async () => {
    feedSlowUntilPaused();
    expect(service.getIsAutoPaused()).toBe(true);

    await service.pauseTracking();

    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(false);
  });

  it('persists and restores auto-pause state', async () => {
    feedSlowUntilPaused();
    expect(service.getIsAutoPaused()).toBe(true);

    const persisted = lastPersisted();
    expect(persisted).toBeDefined();
    const parsed = JSON.parse(persisted ?? '{}') as {
      autoPaused: boolean;
      pauseLocation: Location;
    };
    expect(parsed.autoPaused).toBe(true);
    expect(parsed.pauseLocation.latitude).toBe(LAT);
    expect(parsed.pauseLocation.timestamp).toBe(BASE_MS + 6000);

    await service.startTracking();
    expect(service.getIsAutoPaused()).toBe(false);

    vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(persisted ?? null);
    await service.restoreSession();
    expect(service.getIsAutoPaused()).toBe(true);

    feed(loc(7000, LAT + latOffset(3), LNG));
    expect(service.getIsAutoPaused()).toBe(false);
    expect(service.getIsTracking()).toBe(true);
  });
});
