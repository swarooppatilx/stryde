import { beforeEach, describe, expect, it, vi } from 'vitest';

const watchPositionAsync = vi.hoisted(() => vi.fn(async () => ({ remove: () => {} })));
const getCurrentPositionAsync = vi.hoisted(() =>
  vi.fn(async () => ({
    coords: { latitude: 1, longitude: 2, accuracy: 5 },
    timestamp: 1_000,
  }))
);

vi.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6, Balanced: 3, Low: 2 },
  watchPositionAsync,
  getCurrentPositionAsync,
  getLastKnownPositionAsync: vi.fn(),
  getForegroundPermissionsAsync: vi.fn(),
  requestForegroundPermissionsAsync: vi.fn(),
  geocodeAsync: vi.fn(),
  reverseGeocodeAsync: vi.fn(),
}));
vi.mock('react-native', () => ({ Linking: { openSettings: vi.fn() } }));

const { expoLocationSource } = await import('@/platform/expo/location');

beforeEach(() => {
  watchPositionAsync.mockClear();
  getCurrentPositionAsync.mockClear();
});

describe('expoLocationSource', () => {
  it('never asks Google Play to show its "improved accuracy" dialog when watching', async () => {
    await expoLocationSource.watch(
      { accuracy: 'best', timeIntervalMs: 1000, distanceIntervalM: 1 },
      () => {}
    );

    expect(watchPositionAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mayShowUserSettingsDialog: false }),
      expect.any(Function)
    );
  });

  it('never asks for it on a one-off read either', async () => {
    await expoLocationSource.getCurrent('balanced');

    expect(getCurrentPositionAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mayShowUserSettingsDialog: false })
    );
  });

  it('still passes the accuracy and intervals it was given', async () => {
    await expoLocationSource.watch(
      { accuracy: 'power', timeIntervalMs: 5000, distanceIntervalM: 10 },
      () => {}
    );

    expect(watchPositionAsync).toHaveBeenCalledWith(
      expect.objectContaining({ accuracy: 2, timeInterval: 5000, distanceInterval: 10 }),
      expect.any(Function)
    );
  });
});
