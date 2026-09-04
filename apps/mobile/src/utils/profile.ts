import type { Activity } from '@/types';

export interface StreakData {
  current: number;
  longest: number;
}

export function computeStreak(activities: Activity[]): StreakData {
  if (activities.length === 0) return { current: 0, longest: 0 };

  const daySet = new Set<string>();
  for (const a of activities) {
    const d = new Date(a.createdAt);
    daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }

  const days = Array.from(daySet)
    .map((s) => {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m, d).getTime();
    })
    .sort((a, b) => b - a);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const msPerDay = 86400000;

  let current = 0;
  let expected = todayMs;
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
  for (let i = 1; i < days.length; i++) {
    const diff = (days[i - 1] - days[i]) / msPerDay;
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
}

export function computePersonalRecords(activities: Activity[]): PersonalRecords {
  if (activities.length === 0) {
    return {
      longestDistance: null,
      fastestPace: null,
      largestTerritory: null,
      longestDuration: null,
    };
  }

  let longestDistance = activities[0];
  let fastestPace = activities[0];
  let largestTerritory = activities[0];
  let longestDuration = activities[0];

  for (const a of activities) {
    if (a.distance > longestDistance.distance) longestDistance = a;
    if (a.territoryArea > largestTerritory.territoryArea) largestTerritory = a;
    if (a.duration > longestDuration.duration) longestDuration = a;

    const paceA = a.distance > 0 ? a.duration / a.distance : Infinity;
    const paceB = fastestPace.distance > 0 ? fastestPace.duration / fastestPace.distance : Infinity;
    if (paceA < paceB) fastestPace = a;
  }

  return { longestDistance, fastestPace, largestTerritory, longestDuration };
}

export interface ProfileSettings {
  units: 'metric' | 'imperial';
  theme: 'light' | 'dark' | 'system';
  weeklyGoalDistance: number;
  weeklyGoalActivities: number;
  weeklyGoalTime: number;
}

export const DEFAULT_SETTINGS: ProfileSettings = {
  units: 'metric',
  theme: 'system',
  weeklyGoalDistance: 20000,
  weeklyGoalActivities: 3,
  weeklyGoalTime: 3600000,
};
