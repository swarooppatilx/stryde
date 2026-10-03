import { useSettingsStore } from '@/stores/settingsStore';
import type { Activity } from '@/types';
import { computeAchievements } from '@/utils/achievements';
import { getSportStats, getWeeklyStats } from '@/utils/format';
import { computePersonalRecords, computeStreak } from '@/utils/profile';

export function useProfileStats(activities: Activity[], territoryArea: number) {
  const weekStartsOn = useSettingsStore((s) => s.weekStartsOn);
  const achievements = computeAchievements(activities, territoryArea);
  return {
    totalDistance: activities.reduce((sum, a) => sum + a.distance, 0),
    totalDuration: activities.reduce((sum, a) => sum + a.duration, 0),
    weekly: getWeeklyStats(activities, weekStartsOn),
    sports: getSportStats(activities),
    unlockedAchievements: achievements.filter((a) => a.unlocked),
    streak: computeStreak(activities),
    records: computePersonalRecords(activities),
  };
}
