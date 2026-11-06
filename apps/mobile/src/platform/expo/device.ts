import * as ExpoClipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { getInfoAsync, readAsStringAsync } from 'expo-file-system/legacy';
import * as ExpoHaptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Network from 'expo-network';
import type {
  Clipboard,
  Connectivity,
  Files,
  Haptics,
  IdGenerator,
  MotionSensors,
  PhotoLibrary,
  ScreenAwake,
} from '@/platform/ports';
import { ignoreFailure } from '@/utils/ignoreFailure';
import { logger } from '@/utils/logger';
import { motionSensorService } from './motionSensors';

export const expoIds: IdGenerator = { next: () => Crypto.randomUUID() };

export const expoMotionSensors: MotionSensors = motionSensorService;

function isOnline(state: Network.NetworkState): boolean {
  return (
    state.isConnected !== false &&
    state.isInternetReachable !== false &&
    state.type !== Network.NetworkStateType.NONE
  );
}

export const expoConnectivity: Connectivity = {
  async isOnline() {
    try {
      return isOnline(await Network.getNetworkStateAsync());
    } catch (error) {
      logger.warn('[Device] Network state unreadable, assuming online', error);
      // An unreadable network state shouldn't park every write in the offline queue.
      return true;
    }
  },

  subscribe(onChange) {
    return Network.addNetworkStateListener((state) => onChange(isOnline(state)));
  },
};

/** Feedback is a nicety: a failed buzz must never surface as an error. */
const quiet = (buzz: () => Promise<unknown>) => () => {
  buzz().catch(ignoreFailure);
};

const { ImpactFeedbackStyle: Impact, NotificationFeedbackType: Notification } = ExpoHaptics;

export const expoHaptics: Haptics = {
  tap: quiet(() => ExpoHaptics.impactAsync(Impact.Light)),
  impactMedium: quiet(() => ExpoHaptics.impactAsync(Impact.Medium)),
  impactHeavy: quiet(() => ExpoHaptics.impactAsync(Impact.Heavy)),
  selection: quiet(() => ExpoHaptics.selectionAsync()),
  success: quiet(() => ExpoHaptics.notificationAsync(Notification.Success)),
  warning: quiet(() => ExpoHaptics.notificationAsync(Notification.Warning)),
  error: quiet(() => ExpoHaptics.notificationAsync(Notification.Error)),
};

const KEEP_AWAKE_TAG = 'stryde-recording';

export const expoScreenAwake: ScreenAwake = {
  keepAwake(on) {
    // Best effort: a refused wake lock must never break a recording.
    const request = on
      ? activateKeepAwakeAsync(KEEP_AWAKE_TAG)
      : deactivateKeepAwake(KEEP_AWAKE_TAG);
    request.catch(ignoreFailure);
  },
};

export const expoClipboard: Clipboard = {
  async copyText(text) {
    await ExpoClipboard.setStringAsync(text);
  },
  async readText() {
    return ExpoClipboard.getStringAsync();
  },
};

export const expoPhotoLibrary: PhotoLibrary = {
  async pick({ multiple = false, limit, aspect } = {}) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return { status: 'denied' };
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: multiple,
      selectionLimit: multiple ? limit : undefined,
      allowsEditing: !multiple && !!aspect,
      aspect,
      quality: 0.8,
    });
    return { status: 'picked', uris: result.canceled ? [] : result.assets.map((a) => a.uri) };
  },
};

export const expoFiles: Files = {
  async size(uri) {
    const info = await getInfoAsync(uri);
    return info.exists ? info.size : null;
  },
  readBase64: (uri) => readAsStringAsync(uri, { encoding: 'base64' }),
  readText: (uri) => new File(uri).text(),
  readBytes: (uri) => new File(uri).bytes(),
  writeCache(name, content, encoding = 'utf8') {
    const file = new File(Paths.cache, name);
    file.write(content, encoding === 'base64' ? { encoding } : undefined);
    return file.uri;
  },
};
