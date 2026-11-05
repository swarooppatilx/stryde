import { Platform } from 'react-native';

/**
 * Wearable data via the phone's health hub: Health Connect on Android (fed by
 * Samsung Health, Fitbit, Garmin Connect, Mi Fitness, Wear OS…) and HealthKit
 * on iOS (fed by Apple Watch and most watch companion apps). Native modules
 * load lazily so web, tests and dev clients built before they were added keep
 * working — they just report health data as unavailable.
 */

export interface HeartRateSample {
  timestamp: number;
  bpm: number;
}

export interface HealthAvailability {
  available: boolean;
  platform: 'health-connect' | 'healthkit' | null;
  reason: string | null;
}

export interface ActivityHealthData {
  samples: HeartRateSample[];
  restingBpm: number | null;
  steps: number | null;
}

type HealthConnectModule = typeof import('react-native-health-connect');
type HealthKitModule = typeof import('@kingstinct/react-native-healthkit');

const HEALTH_CONNECT_PERMISSIONS = [
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'Steps' },
] as const;

const HEALTHKIT_READ = [
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierStepCount',
] as const;

let healthConnect: HealthConnectModule | null | undefined;
let healthKit: HealthKitModule | null | undefined;
let healthConnectReady = false;

function loadHealthConnect(): HealthConnectModule | null {
  if (healthConnect !== undefined) return healthConnect;
  try {
    healthConnect = require('react-native-health-connect') as HealthConnectModule;
  } catch {
    healthConnect = null;
  }
  return healthConnect;
}

function loadHealthKit(): HealthKitModule | null {
  if (healthKit !== undefined) return healthKit;
  try {
    healthKit = require('@kingstinct/react-native-healthkit') as HealthKitModule;
  } catch {
    healthKit = null;
  }
  return healthKit;
}

async function ensureHealthConnect(): Promise<HealthConnectModule | null> {
  const hc = loadHealthConnect();
  if (!hc) return null;
  if (!healthConnectReady) healthConnectReady = await hc.initialize();
  return healthConnectReady ? hc : null;
}

export async function getHealthAvailability(): Promise<HealthAvailability> {
  try {
    if (Platform.OS === 'android') {
      const hc = loadHealthConnect();
      if (!hc) return { available: false, platform: null, reason: 'Rebuild the app to enable Health Connect.' };
      const status = await hc.getSdkStatus();
      if (status === hc.SdkAvailabilityStatus.SDK_AVAILABLE) {
        return { available: true, platform: 'health-connect', reason: null };
      }
      return {
        available: false,
        platform: 'health-connect',
        reason:
          status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
            ? 'Update Health Connect from the Play Store.'
            : 'Install Health Connect from the Play Store.',
      };
    }
    if (Platform.OS === 'ios') {
      const hk = loadHealthKit();
      if (!hk) return { available: false, platform: null, reason: 'Rebuild the app to enable HealthKit.' };
      return hk.isHealthDataAvailable()
        ? { available: true, platform: 'healthkit', reason: null }
        : { available: false, platform: 'healthkit', reason: 'Health data is not available on this device.' };
    }
  } catch (error) {
    return { available: false, platform: null, reason: (error as Error).message };
  }
  return { available: false, platform: null, reason: 'Health data is only available on Android and iOS.' };
}

/** Prompts for read access to heart rate, resting heart rate and steps. */
export async function requestHealthPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const hc = await ensureHealthConnect();
    if (!hc) return false;
    const granted = await hc.requestPermission([...HEALTH_CONNECT_PERMISSIONS]);
    return granted.some((p) => p.recordType === 'HeartRate');
  }
  if (Platform.OS === 'ios') {
    const hk = loadHealthKit();
    if (!hk) return false;
    return hk.requestAuthorization({ toRead: HEALTHKIT_READ });
  }
  return false;
}

export function openHealthSettings(): void {
  if (Platform.OS === 'android') loadHealthConnect()?.openHealthConnectSettings();
}

async function readAndroid(start: Date, end: Date): Promise<ActivityHealthData> {
  const hc = await ensureHealthConnect();
  if (!hc) return { samples: [], restingBpm: null, steps: null };
  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };

  const heart = await hc.readRecords('HeartRate', { timeRangeFilter, ascendingOrder: true });
  const samples = heart.records.flatMap((record) =>
    record.samples.map((s) => ({ timestamp: new Date(s.time).getTime(), bpm: s.beatsPerMinute }))
  );

  let restingBpm: number | null = null;
  try {
    const dayBefore = new Date(start.getTime() - 24 * 3600_000);
    const resting = await hc.readRecords('RestingHeartRate', {
      timeRangeFilter: { operator: 'between', startTime: dayBefore.toISOString(), endTime: end.toISOString() },
      ascendingOrder: false,
      pageSize: 1,
    });
    restingBpm = resting.records[0]?.beatsPerMinute ?? null;
  } catch {
    restingBpm = null;
  }

  let steps: number | null = null;
  try {
    const stepRecords = await hc.readRecords('Steps', { timeRangeFilter });
    steps = stepRecords.records.reduce((sum, r) => sum + r.count, 0);
  } catch {
    steps = null;
  }

  return { samples, restingBpm, steps };
}

async function readIos(start: Date, end: Date): Promise<ActivityHealthData> {
  const hk = loadHealthKit();
  if (!hk) return { samples: [], restingBpm: null, steps: null };
  const filter = { date: { startDate: start, endDate: end } };

  const heart = await hk.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
    filter,
    limit: 0,
    ascending: true,
    unit: 'count/min',
  });
  const samples = heart.map((s) => ({ timestamp: new Date(s.startDate).getTime(), bpm: s.quantity }));

  let restingBpm: number | null = null;
  try {
    const resting = await hk.queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', {
      filter: { date: { startDate: new Date(start.getTime() - 24 * 3600_000), endDate: end } },
      limit: 1,
      ascending: false,
      unit: 'count/min',
    });
    restingBpm = resting[0]?.quantity ?? null;
  } catch {
    restingBpm = null;
  }

  let steps: number | null = null;
  try {
    const stepSamples = await hk.queryQuantitySamples('HKQuantityTypeIdentifierStepCount', {
      filter,
      limit: 0,
      unit: 'count',
    });
    steps = Math.round(stepSamples.reduce((sum, s) => sum + s.quantity, 0));
  } catch {
    steps = null;
  }

  return { samples, restingBpm, steps };
}

/** Heart rate, resting heart rate and steps recorded by the user's wearable during an activity. */
export async function readActivityHealthData(start: Date, end: Date): Promise<ActivityHealthData> {
  try {
    if (Platform.OS === 'android') return await readAndroid(start, end);
    if (Platform.OS === 'ios') return await readIos(start, end);
  } catch (error) {
    console.warn('[health] Could not read wearable data:', error);
  }
  return { samples: [], restingBpm: null, steps: null };
}
