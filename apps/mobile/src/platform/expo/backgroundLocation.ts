import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoLocation from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import { Palette } from '@/constants/palette';
import { locationRequestFor } from '@/platform/locationRequest';
import type { BackgroundLocation, StorageAdapter } from '@/platform/ports';
import type { AccuracyMode } from '@/stores/settingsStore';
import type { Location } from '@/types';
import { logger } from '@/utils/logger';
import { fixFromCoords } from './fixFromCoords';

const BACKGROUND_LOCATION_TASK = 'stryde-background-location';

/** Where the headless task buffers fixes while the app is dead/backgrounded. */
const BACKGROUND_POINTS_KEY = '@stryde/background-points';
/** About four hours at the best-accuracy rate of one fix a second. */
const MAX_BUFFERED_POINTS = 15_000;

// The headless task runs in its own JS context before any platform is
// installed, so it talks to AsyncStorage directly rather than via getPlatform().
const storage: StorageAdapter = AsyncStorage;

const ACCURACY_BY_MODE = {
  best: ExpoLocation.Accuracy.High,
  balanced: ExpoLocation.Accuracy.Balanced,
  power: ExpoLocation.Accuracy.Low,
} as const;

/**
 * Headless task body. React state doesn't exist here, so the task only
 * persists raw fixes. The tracking session drains them back into the
 * tracking service when the app next foregrounds.
 */
TaskManager.defineTask(
  BACKGROUND_LOCATION_TASK,
  async ({
    data,
    error,
  }: {
    data?: { locations?: ExpoLocation.LocationObject[] };
    error?: unknown;
  }) => {
    try {
      if (error) {
        logger.warn('[BackgroundLocation] Task error:', error);
        return;
      }
      const locations = data?.locations;
      if (!locations || locations.length === 0) return;

      const existingRaw = await storage.getItem(BACKGROUND_POINTS_KEY);
      const existing: Location[] = existingRaw ? (JSON.parse(existingRaw) ?? []) : [];

      for (const fix of locations) {
        const point: Location = fixFromCoords(fix.coords, fix.timestamp, fix.mocked);
        const prev = existing[existing.length - 1];
        // Cheap dedupe: skip near-duplicate consecutive fixes.
        if (
          prev &&
          Math.abs(prev.latitude - point.latitude) < 1e-6 &&
          Math.abs(prev.longitude - point.longitude) < 1e-6
        ) {
          continue;
        }
        existing.push(point);
      }

      const trimmed =
        existing.length > MAX_BUFFERED_POINTS ? existing.slice(-MAX_BUFFERED_POINTS) : existing;
      await storage.setItem(BACKGROUND_POINTS_KEY, JSON.stringify(trimmed));
    } catch (err) {
      logger.warn('[BackgroundLocation] Task failed:', err);
    }
  }
);

/** Only ask once per app session; a refusal costs the notification, never the run. */
let askedForNotifications = false;

/** Persists the ask across cold starts: ColorOS dialogs that never settle also never record the answer. */
const NOTIFICATIONS_ASKED_KEY = '@stryde/notifications-asked';

/**
 * Android 13+ hides the foreground-service notification unless POST_NOTIFICATIONS is granted, so it is requested
 * but never awaited: on Android 15 (ColorOS) the request never settles while notifications are blocked, and
 * awaiting it would hang start() before startLocationUpdatesAsync ran, leaving the run foreground-only.
 */
function requestNotificationPermission(): void {
  if (askedForNotifications) return;
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return;
  askedForNotifications = true;
  try {
    void (async () => {
      // Ask once per install. A request that never settles (Android 15/ColorOS) can't
      // remember the answer, so the OS prompt alone would re-open on every cold start.
      if (await storage.getItem(NOTIFICATIONS_ASKED_KEY)) return;
      await storage.setItem(NOTIFICATIONS_ASKED_KEY, '1');
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    })().catch((err) => {
      logger.warn('[BackgroundLocation] Notification permission request failed:', err);
    });
  } catch (err) {
    logger.warn('[BackgroundLocation] Notification permission request failed:', err);
  }
}

/**
 * Android 11+ refuses to grant "all the time" from the in-app prompt — the athlete has to
 * do it in Settings — so only the first ask per app session is worth making. Without this
 * guard the foreground-return retry (see TrackingSession.syncBackground) would re-request
 * every time, which on Android 10 pops a dialog again on each return.
 */
let askedForBackgroundPermission = false;

async function ensureRegistered(): Promise<boolean> {
  try {
    // Check before asking: the athlete may have granted "all the time" in Settings while
    // the run was live, and the retry has to notice that without prompting again.
    if ((await ExpoLocation.getBackgroundPermissionsAsync()).granted) return true;
    if (askedForBackgroundPermission) return false;
    askedForBackgroundPermission = true;
    const status = await ExpoLocation.requestBackgroundPermissionsAsync();
    return status.granted;
  } catch (err) {
    logger.warn('[BackgroundLocation] Registration check failed:', err);
    return false;
  }
}

export const expoBackgroundLocation: BackgroundLocation = {
  /**
   * Must be called while the session is foreground-tracked so permission can
   * be requested (Android requires foreground-before-background). Resolves
   * false on failure so callers degrade silently to foreground-only.
   */
  async start(mode: AccuracyMode, activityName: string) {
    if (Platform.OS === 'web') return false;

    try {
      if (!(await ensureRegistered())) return false;
      requestNotificationPermission();

      const request = locationRequestFor(mode);
      await ExpoLocation.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: ACCURACY_BY_MODE[mode],
        timeInterval: request.timeIntervalMs,
        distanceInterval: request.distanceIntervalM,
        pausesUpdatesAutomatically: false,
        activityType: ExpoLocation.ActivityType.Fitness,
        foregroundService: {
          notificationTitle: 'Stryde is recording',
          notificationBody: `${activityName} in progress — tap to return to the app.`,
          notificationColor: Palette.orange.o3,
        },
      });
      return true;
    } catch (err) {
      logger.warn('[BackgroundLocation] Start failed:', err);
      return false;
    }
  },

  /**
   * From the in-run banner: with canAskAgain this pops the system grant dialog (the
   * full Location page on ColorOS); once the OS has downgraded the ask (`USER_FIXED`,
   * seen on this phone after the dialog was denied twice) the request would resolve
   * silently with no UI, so route to Settings instead; App Info is the only road left.
   */
  async requestPermission() {
    try {
      const status = await ExpoLocation.getBackgroundPermissionsAsync();
      if (!status.canAskAgain) {
        await Linking.openSettings();
        return;
      }
      await ExpoLocation.requestBackgroundPermissionsAsync();
    } catch (err) {
      logger.warn('[BackgroundLocation] Permission request failed:', err);
      await Linking.openSettings();
    }
  },

  /** Safe to call when the task never started: stopping an unregistered task throws. */
  async stop() {
    try {
      if (!(await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK))) return;
      await ExpoLocation.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch (err) {
      logger.warn('[BackgroundLocation] Stop failed:', err);
    }
  },

  async peek() {
    const raw = await storage.getItem(BACKGROUND_POINTS_KEY);
    return raw ? (JSON.parse(raw) as Location[]) : [];
  },

  async clear() {
    await storage.removeItem(BACKGROUND_POINTS_KEY);
  },
};
