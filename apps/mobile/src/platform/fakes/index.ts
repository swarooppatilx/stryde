import { installPlatform, type Platform, resetPlatform } from '@/platform/index';
import {
  FakeClock,
  FakeConnectivity,
  FakeDeviceReadiness,
  FakeHealthSource,
  FakeMotionSensors,
  FakePushNotifications,
  FakeScreenAwake,
  MemoryClipboard,
  MemoryFiles,
  MemoryStorage,
  RecordingHaptics,
  RecordingSpeaker,
  ScriptedPhotoLibrary,
  ScriptedPrompter,
  SequentialIds,
} from './device';
import { FakeBackgroundLocation, FakeGeocoder, FakeLocationSource } from './location';

export * from './device';
export * from './location';
export * from './tracks';

/** A Platform whose members keep their concrete fake types, so tests can script and inspect them. */
export interface FakePlatform extends Platform {
  clock: FakeClock;
  ids: SequentialIds;
  storage: MemoryStorage;
  location: FakeLocationSource;
  background: FakeBackgroundLocation;
  motion: FakeMotionSensors;
  connectivity: FakeConnectivity;
  haptics: RecordingHaptics;
  speaker: RecordingSpeaker;
  screenAwake: FakeScreenAwake;
  prompter: ScriptedPrompter;
  geocoder: FakeGeocoder;
  clipboard: MemoryClipboard;
  photos: ScriptedPhotoLibrary;
  files: MemoryFiles;
  health: FakeHealthSource;
  readiness: FakeDeviceReadiness;
  push: FakePushNotifications;
}

export function createFakePlatform(overrides: Partial<FakePlatform> = {}): FakePlatform {
  return {
    clock: new FakeClock(),
    ids: new SequentialIds(),
    storage: new MemoryStorage(),
    location: new FakeLocationSource(),
    background: new FakeBackgroundLocation(),
    motion: new FakeMotionSensors(),
    connectivity: new FakeConnectivity(),
    haptics: new RecordingHaptics(),
    speaker: new RecordingSpeaker(),
    screenAwake: new FakeScreenAwake(),
    prompter: new ScriptedPrompter(),
    geocoder: new FakeGeocoder(),
    clipboard: new MemoryClipboard(),
    photos: new ScriptedPhotoLibrary(),
    files: new MemoryFiles(),
    health: new FakeHealthSource(),
    readiness: new FakeDeviceReadiness(),
    push: new FakePushNotifications(),
    ...overrides,
  };
}

/** Fresh fakes, installed as the active platform. Pair with `uninstallFakePlatform` in afterEach. */
export function installFakePlatform(overrides: Partial<FakePlatform> = {}): FakePlatform {
  const platform = createFakePlatform(overrides);
  installPlatform(platform);
  return platform;
}

export function uninstallFakePlatform(): void {
  resetPlatform();
}
