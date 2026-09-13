import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import type { AccuracyMode } from '@/stores/settingsStore';
import { asyncStorageAdapter } from '@/utils/storage';

export const BACKGROUND_LOCATION_TASK = 'stryde-background-location';

/** ephem key the headless task uses to buffer points while the app is dead/backgrounded. */
const BACKGROUND_POINTS_KEY = '@stryde/background-points';
const MAX_BUFFERED_POINTS = 5000;

const ACCURACY_BY_MODE = {
  best: Location.Accuracy.High,
  balanced: Location.Accuracy.Balanced,
  power: Location.Accuracy.Low,
} as const;

interface BackgroundPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
}

/**
 * Headless task body. Runs in its own JS context — React state doesn't exist
 * here, so the task only persists raw fixes to AsyncStorage. The tracking
 * screen drains these back into trackingService when the app next foregrounds.
 */
TaskManager.defineTask(
  BACKGROUND_LOCATION_TASK,
  async ({
    data,
    error,
  }: {
    data?: { locations?: Location.LocationObject[] };
    error?: unknown;
  }) => {
    try {
      if (error) {
        console.warn('[BackgroundLocation] Task error:', error);
        return;
      }
      const locations = data?.locations;
      if (!locations || locations.length === 0) return;

      const existingRaw = await asyncStorageAdapter.getItem(BACKGROUND_POINTS_KEY);
      const existing: BackgroundPoint[] = existingRaw ? (JSON.parse(existingRaw) ?? []) : [];

      for (const fix of locations) {
        const point: BackgroundPoint = {
          latitude: fix.coords.latitude,
          longitude: fix.coords.longitude,
          timestamp: fix.timestamp,
          accuracy: fix.coords.accuracy ?? 0,
        };
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
      await asyncStorageAdapter.setItem(BACKGROUND_POINTS_KEY, JSON.stringify(trimmed));
    } catch (err) {
      console.warn('[BackgroundLocation] Task failed:', err);
    }
  }
);

async function ensureRegistered(): Promise<boolean> {
  try {
    const existing = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (existing) return true;
    const status = await Location.requestBackgroundPermissionsAsync();
    return status.granted;
  } catch (err) {
    console.warn('[BackgroundLocation] Registration check failed:', err);
    return false;
  }
}

/**
 * Starts continuous background location via expo-location's TaskManager task.
 * Must be called while the session is foregound-tracked so that permission
 * can be requested (Android requires foreground-before-background). On failure
 * it resolves false so callers can degrade silently to foreground-only.
 */
export async function startBackgroundLocation(
  mode: AccuracyMode,
  activityName: string
): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const canTrack = await ensureRegistered();
    if (!canTrack) return false;

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: ACCURACY_BY_MODE[mode],
      timeInterval: 5000,
      distanceInterval: 1,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Fitness,
      foregroundService: {
        notificationTitle: 'Stryde is recording',
        notificationBody: `${activityName} in progress — tap to return to the app.`,
        notificationColor: '#E14502',
      },
    });
    return true;
  } catch (err) {
    console.warn('[BackgroundLocation] Start failed:', err);
    return false;
  }
}

/**
 * Stops the background task. Safe to call even when the task never started —
 * startLocationUpdatesAsync throws if not registered, so we stop by name when
 * it is.
 */
export async function stopBackgroundLocation(): Promise<void> {
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK))) return;
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch (err) {
    console.warn('[BackgroundLocation] Stop failed:', err);
  }
}

/** Reads buffered background fixes without draining them. */
export async function peekBackgroundPoints(): Promise<BackgroundPoint[]> {
  const raw = await asyncStorageAdapter.getItem(BACKGROUND_POINTS_KEY);
  return raw ? (JSON.parse(raw) as BackgroundPoint[]) : [];
}

/** Clears the buffered fixes after the app has drained them into tracking. */
export async function clearBackgroundPoints(): Promise<void> {
  await asyncStorageAdapter.removeItem(BACKGROUND_POINTS_KEY);
}

/** True when a background session is currently registered. */
export async function isBackgroundTrackingActive(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
}
