import AsyncStorage from '@react-native-async-storage/async-storage';
import { systemClock } from '@/platform/clock';
import type { Platform } from '@/platform/ports';
import { expoBackgroundLocation } from './backgroundLocation';
import {
  expoClipboard,
  expoConnectivity,
  expoFiles,
  expoHaptics,
  expoIds,
  expoMotionSensors,
  expoPhotoLibrary,
  expoScreenAwake,
} from './device';
import { expoHealthSource } from './health';
import { expoGeocoder, expoLocationSource } from './location';
import { expoPrompter } from './prompter';
import { expoPushNotifications } from './pushNotifications';
import { expoDeviceReadiness } from './readiness';
import { expoSpeaker } from './speaker';

/** The real device. The only place Expo modules are wired in. */
export function createExpoPlatform(): Platform {
  return {
    clock: systemClock,
    ids: expoIds,
    storage: AsyncStorage,
    location: expoLocationSource,
    background: expoBackgroundLocation,
    motion: expoMotionSensors,
    connectivity: expoConnectivity,
    haptics: expoHaptics,
    speaker: expoSpeaker,
    screenAwake: expoScreenAwake,
    prompter: expoPrompter,
    geocoder: expoGeocoder,
    clipboard: expoClipboard,
    photos: expoPhotoLibrary,
    files: expoFiles,
    health: expoHealthSource,
    readiness: expoDeviceReadiness,
    push: expoPushNotifications,
  };
}
