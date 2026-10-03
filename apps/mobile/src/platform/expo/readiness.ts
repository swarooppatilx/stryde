import { Paths } from 'expo-file-system';
import * as ExpoLocation from 'expo-location';
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import type { DeviceReadiness } from '@/platform/ports';

/** Best effort: anything the phone will not answer is null, which the checks treat as fine. */
async function attempt<T>(read: () => Promise<T> | T): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

export const expoDeviceReadiness: DeviceReadiness = {
  backgroundLocationAllowed() {
    if (Platform.OS === 'web') return Promise.resolve(null);
    return attempt(async () => (await ExpoLocation.getBackgroundPermissionsAsync()).granted);
  },

  notificationsAllowed() {
    if (Platform.OS !== 'android') return Promise.resolve(null);
    // Before Android 13 notifications need no permission, so there is nothing to be denied.
    if (Number(Platform.Version) < 33) return Promise.resolve(true);
    return attempt(() =>
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
    );
  },

  async freeStorageBytes() {
    return attempt(() => Paths.availableDiskSpace);
  },

  openAppSettings() {
    return Linking.openSettings();
  },
};
