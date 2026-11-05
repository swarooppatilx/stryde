import type { HealthBody, HealthSource, HealthStatus, HealthWorkout } from '@/platform/ports';
import type { ActivityType } from '@/types';
import { bodyFromHealth, routeFromHealth, summariseHeartRate } from '@/utils/healthMapping';
import { logger } from '@/utils/logger';

/**
 * Health Connect through `react-native-health-connect`. The module is loaded on first use and
 * every call is guarded: a build made before the native module was added (or a phone with no
 * Health Connect) answers "unavailable" instead of crashing the app.
 */
type Lib = typeof import('react-native-health-connect');

function loadLib(): Lib | null {
  try {
    return require('react-native-health-connect') as Lib;
  } catch (error) {
    logger.warn('[Health] heart rate read failed', error);
    return null;
  }
}

/**
 * What an import needs. Only the workout itself is required: a phone that grants less still imports,
 * each extra (distance, heart rate, calories) is read on its own and skipped if not allowed.
 */
const WORKOUT_PERMISSIONS = [
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
] as const;
/** Asked for on their own, from the Body screen, when the athlete asks to fill it in. */
const BODY_PERMISSIONS = [
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'Height' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
] as const;
const BODY_TYPES: ReadonlySet<string> = new Set(['Weight', 'Height', 'RestingHeartRate']);
/** `ExerciseRouteResultType.DATA`: the library declares the enum but does not export it. */
const ROUTE_HAS_DATA = 0;
const SESSIONS_PER_PAGE = 100;
const HEART_PAGES_MAX = 20;
const BODY_RECORDS = 100;
const FIVE_YEARS_MS = 5 * 365 * 86_400_000;

/** Which supported sport a Health Connect exercise type maps to; others are left out of an import. */
function sportOf(lib: Lib, exerciseType: number): ActivityType | null {
  const t = lib.ExerciseType;
  const map = new Map<number, ActivityType>([
    [t.RUNNING, 'run'],
    [t.RUNNING_TREADMILL, 'run'],
    [t.BIKING, 'ride'],
    [t.BIKING_STATIONARY, 'ride'],
    [t.WALKING, 'walk'],
    [t.HIKING, 'hike'],
    [t.SWIMMING_POOL, 'swim'],
    [t.SWIMMING_OPEN_WATER, 'swim'],
    [t.YOGA, 'yoga'],
    [t.STRENGTH_TRAINING, 'workout'],
    [t.HIGH_INTENSITY_INTERVAL_TRAINING, 'hiit'],
    [t.DANCING, 'dance'],
    [t.ROCK_CLIMBING, 'climb'],
    [t.SKATING, 'skate'],
    [t.ROWING, 'row'],
    [t.ROWING_MACHINE, 'row'],
  ]);
  return map.get(exerciseType) ?? null;
}

export const expoHealthSource: HealthSource = {
  async status(): Promise<HealthStatus> {
    const lib = loadLib();
    if (!lib) return 'unavailable';
    try {
      const status = await lib.getSdkStatus();
      if (status === lib.SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
      if (status === lib.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        return 'update-required';
      }
      return 'unavailable';
    } catch (error) {
      logger.warn('[Health] status check failed', error);
      return 'unavailable';
    }
  },

  async hasAccess() {
    const lib = loadLib();
    if (!lib) return false;
    try {
      await lib.initialize();
      const granted = await lib.getGrantedPermissions();
      return granted.some((p) => p.recordType === 'ExerciseSession');
    } catch (error) {
      logger.warn('[Health] access check failed', error);
      return false;
    }
  },

  async requestAccess() {
    const lib = loadLib();
    if (!lib) return false;
    try {
      await lib.initialize();
      const granted = await lib.requestPermission([...WORKOUT_PERMISSIONS]);
      return granted.some((p) => p.recordType === 'ExerciseSession');
    } catch (error) {
      logger.warn('[Health] access request failed', error);
      return false;
    }
  },

  async readWorkouts(since) {
    const lib = loadLib();
    if (!lib) return [];
    await lib.initialize();
    const workouts: HealthWorkout[] = [];
    let pageToken: string | undefined;
    do {
      const page = await lib.readRecords('ExerciseSession', {
        timeRangeFilter: { operator: 'after', startTime: new Date(since).toISOString() },
        pageSize: SESSIONS_PER_PAGE,
        pageToken,
      });
      for (const session of page.records) {
        const sport = sportOf(lib, session.exerciseType);
        const id = session.metadata?.id;
        if (!sport || !id) continue;
        const range = {
          operator: 'between',
          startTime: session.startTime,
          endTime: session.endTime,
        } as const;
        const distance = await lib
          .aggregateRecord({ recordType: 'Distance', timeRangeFilter: range })
          .then((result) => result.DISTANCE?.inMeters ?? 0)
          .catch((error) => {
            logger.warn('[Health] distance read failed', error);
            return 0;
          });
        const startTime = new Date(session.startTime).getTime();
        const heartRate = await readHeartRate(lib, range, startTime);
        const calories = await lib
          .aggregateRecord({ recordType: 'TotalCaloriesBurned', timeRangeFilter: range })
          .then((result) => Math.round(result.ENERGY_TOTAL?.inKilocalories ?? 0))
          .catch((error) => {
            logger.warn('[Health] calories read failed', error);
            return 0;
          });
        // A route that needs the athlete's consent per workout is left out: an import must not
        // throw a system prompt per workout at them.
        const exerciseRoute = session.exerciseRoute;
        const route =
          exerciseRoute?.type === ROUTE_HAS_DATA ? routeFromHealth(exerciseRoute.route) : null;
        workouts.push({
          id,
          sport,
          startTime,
          endTime: new Date(session.endTime).getTime(),
          distanceM: Math.round(distance),
          ...(session.title ? { title: session.title } : {}),
          ...(heartRate ? { heartRate } : {}),
          ...(calories > 0 ? { calories } : {}),
          ...(route ? { route } : {}),
        });
      }
      pageToken = page.pageToken;
    } while (pageToken);
    return workouts.sort((a, b) => a.startTime - b.startTime);
  },

  async hasBodyAccess() {
    const lib = loadLib();
    if (!lib) return false;
    try {
      await lib.initialize();
      const granted = await lib.getGrantedPermissions();
      return granted.some((p) => BODY_TYPES.has(p.recordType));
    } catch (error) {
      logger.warn('[Health] body access check failed', error);
      return false;
    }
  },

  async requestBodyAccess() {
    const lib = loadLib();
    if (!lib) return false;
    try {
      await lib.initialize();
      const granted = await lib.requestPermission([...BODY_PERMISSIONS]);
      return granted.some((p) => BODY_TYPES.has(p.recordType));
    } catch (error) {
      logger.warn('[Health] body access request failed', error);
      return false;
    }
  },

  async readBody(): Promise<HealthBody> {
    const lib = loadLib();
    if (!lib) return {};
    try {
      await lib.initialize();
      const since = new Date(Date.now() - FIVE_YEARS_MS).toISOString();
      const read = <T extends 'Weight' | 'Height' | 'RestingHeartRate'>(type: T) =>
        lib
          .readRecords(type, {
            timeRangeFilter: { operator: 'after', startTime: since },
            ascendingOrder: false,
            pageSize: BODY_RECORDS,
          })
          .then((page) => page.records)
          .catch((error) => {
            logger.warn(`[Health] ${type} read failed`, error);
            return [];
          });
      const [weights, heights, resting] = await Promise.all([
        read('Weight'),
        read('Height'),
        read('RestingHeartRate'),
      ]);
      // Reads come back as unit-bundles (inKilograms, inMeters); the mapping takes one value and its unit.
      return bodyFromHealth({
        weights: weights.map((r) => ({
          time: r.time,
          weight: { value: r.weight.inKilograms, unit: 'kilograms' as const },
        })),
        heights: heights.map((r) => ({
          time: r.time,
          height: { value: r.height.inMeters, unit: 'meters' as const },
        })),
        resting,
      });
    } catch (error) {
      logger.warn('[Health] body read failed', error);
      return {};
    }
  },
};

/** Heart-rate readings across a workout, summarised; null when none were recorded or the read was not allowed. */
async function readHeartRate(
  lib: Lib,
  range: { operator: 'between'; startTime: string; endTime: string },
  startMs: number
) {
  try {
    const samples: Array<{ time: string; beatsPerMinute: number }> = [];
    let pageToken: string | undefined;
    for (let page = 0; page < HEART_PAGES_MAX; page++) {
      const result = await lib.readRecords('HeartRate', {
        timeRangeFilter: range,
        pageSize: 1000,
        pageToken,
      });
      for (const record of result.records) samples.push(...record.samples);
      pageToken = result.pageToken;
      if (!pageToken) break;
    }
    return summariseHeartRate(samples, startMs);
  } catch (error) {
    logger.warn('[Health] heart rate read failed', error);
    return null;
  }
}
