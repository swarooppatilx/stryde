import { installPlatform, type Platform, resetPlatform } from '@/platform/index';
import { FakeBleSensors } from './ble';
import {
  FakeBattery,
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
import { FakeWatchLink } from './watch';

export * from './ble';
export * from './device';
export * from './location';
export * from './tracks';
export * from './watch';

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
  watch: FakeWatchLink;
  readiness: FakeDeviceReadiness;
  push: FakePushNotifications;
  battery: FakeBattery;
  ble: FakeBleSensors;
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
    watch: new FakeWatchLink(),
    readiness: new FakeDeviceReadiness(),
    push: new FakePushNotifications(),
    battery: new FakeBattery(),
    ble: new FakeBleSensors(),
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
