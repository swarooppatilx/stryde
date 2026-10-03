import type { Activity, ActivityType, BestEffort } from '@/types';
import { showsSpeed } from '@/utils/format';
import { isPlausibleBestEffort } from './bestEfforts';
import { pairs } from './pairs';

export interface StreakData {
  current: number;
  longest: number;
}

export function computeStreak(activities: Activity[]): StreakData {
  if (activities.length === 0) return { current: 0, longest: 0 };

  const daySet = new Set<number>();
  for (const a of activities) {
    const d = new Date(a.createdAt);
    daySet.add(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
  }

  const days = Array.from(daySet).sort((a, b) => b - a);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const msPerDay = 86400000;

  let current = 0;
  // Give grace: if user hasn't exercised today yet, start counting from yesterday
  let expected = daySet.has(todayMs) ? todayMs : todayMs - msPerDay;
  for (const day of days) {
    if (day === expected) {
      current++;
      expected -= msPerDay;
    } else {
      break;
    }
  }

  let longest = 0;
  let streak = 1;
  for (const [newer, older] of pairs(days)) {
    const diff = (newer - older) / msPerDay;
    if (diff === 1) {
      streak++;
    } else {
      longest = Math.max(longest, streak);
      streak = 1;
    }
  }
  longest = Math.max(longest, streak);

  return { current, longest };
}

export interface PersonalRecords {
  longestDistance: Activity | null;
  fastestPace: Activity | null;
  largestTerritory: Activity | null;
  longestDuration: Activity | null;
  /** The quickest time ever recorded for each standard distance, shortest distance first. */
  bestEfforts: BestEffort[];
}

/** Shorter efforts are sprints, not a pace anyone sustained. */
const MIN_PACE_RECORD_METERS = 1000;

const msPerMeter = (a: Activity) => a.duration / a.distance;

/** A pace record is for pace sports (not rides), over a real distance, and recorded rather than typed in. */
function countsForPaceRecord(a: Activity): boolean {
  return !showsSpeed(a.activityType) && !a.isManual && a.distance >= MIN_PACE_RECORD_METERS;
}

function quickestEfforts(activities: Activity[]): BestEffort[] {
  const quickest = new Map<number, number>();
  for (const a of activities) {
    for (const effort of a.bestEfforts ?? []) {
      if (!isPlausibleBestEffort(effort, a.distance, a.activityType)) continue;
      const known = quickest.get(effort.distance);
      if (known === undefined || effort.movingTime < known) {
        quickest.set(effort.distance, effort.movingTime);
      }
    }
  }
  return [...quickest]
    .map(([distance, movingTime]) => ({ distance, movingTime }))
    .sort((a, b) => a.distance - b.distance);
}

/** The activities of one sport (or all of them), in their original order. */
export function filterBySport(
  activities: readonly Activity[],
  sport: ActivityType | 'all'
): Activity[] {
  return sport === 'all' ? [...activities] : activities.filter((a) => a.activityType === sport);
}

export function computePersonalRecords(activities: Activity[]): PersonalRecords {
  const first = activities[0];
  if (!first) {
    return {
      longestDistance: null,
      fastestPace: null,
      largestTerritory: null,
      longestDuration: null,
      bestEfforts: [],
    };
  }

  let longestDistance = first;
  let fastestPace: Activity | null = null;
  let largestTerritory = first;
  let longestDuration = first;

  for (const a of activities) {
    if (a.distance > longestDistance.distance) longestDistance = a;
    if (a.territoryArea > largestTerritory.territoryArea) largestTerritory = a;
    if (a.duration > longestDuration.duration) longestDuration = a;

    if (countsForPaceRecord(a) && (!fastestPace || msPerMeter(a) < msPerMeter(fastestPace))) {
      fastestPace = a;
    }
  }

  return {
    longestDistance,
    fastestPace,
    largestTerritory,
    longestDuration,
    bestEfforts: quickestEfforts(activities),
  };
}

export interface ProfileSettings {
  units: 'metric' | 'imperial';
  theme: 'light' | 'dark' | 'system';
  weeklyGoalDistance: number;
  weeklyGoalActivities: number;
  weeklyGoalTime: number;
  /** Body weight in kilograms, kept on this device to estimate calories; unset until given. */
  weightKg?: number;
  /** Height in centimetres, kept on this device for BMI and resting energy; unset until given. */
  heightCm?: number;
  /** A maximum heart rate the athlete measured or knows, in bpm; used for zones instead of the age estimate. */
  maxHeartRate?: number;
  /** A resting heart rate in bpm; with the maximum it gives zones by heart-rate reserve. */
  restingHeartRate?: number;
  /** Where heart-rate zones 2 to 5 begin, as shares of max (or reserve); unset means the usual 60/70/80/90 %. */
  hrZoneFloors?: readonly [number, number, number, number];
}

export const DEFAULT_SETTINGS: ProfileSettings = {
  units: 'metric',
  theme: 'system',
  weeklyGoalDistance: 20000,
  weeklyGoalActivities: 3,
  weeklyGoalTime: 3600000,
};
