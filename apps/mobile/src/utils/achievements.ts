import { AchievementColors } from '@/constants/theme';
import type { Activity } from '@/types';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  unlocked: boolean;
}

export function computeAchievements(activities: Activity[], totalArea: number): Achievement[] {
  const totalDistance = activities.reduce((sum, a) => sum + a.distance, 0);
  const totalActivities = activities.length;
  const uniqueDays = new Set(activities.map((a) => new Date(a.createdAt).toDateString())).size;

  const achievements: Achievement[] = [
    {
      id: 'first_activity',
      title: 'First Activity',
      description: 'Complete your first activity',
      icon: 'flag',
      color: AchievementColors.green,
      unlocked: totalActivities >= 1,
    },
    {
      id: 'five_activities',
      title: 'Getting Started',
      description: 'Complete 5 activities',
      icon: 'flame',
      color: AchievementColors.orange,
      unlocked: totalActivities >= 5,
    },
    {
      id: 'ten_activities',
      title: 'Dedicated',
      description: 'Complete 10 activities',
      icon: 'trophy',
      color: AchievementColors.yellow,
      unlocked: totalActivities >= 10,
    },
    {
      id: 'first_territory',
      title: 'Territory Pioneer',
      description: 'Capture your first territory',
      icon: 'map',
      color: AchievementColors.blue,
      unlocked: totalArea > 0,
    },
    {
      id: 'ten_thousand_sqm',
      title: 'Map Maker',
      description: 'Capture 10,000m² of territory',
      icon: 'globe',
      color: AchievementColors.indigo,
      unlocked: totalArea >= 10_000,
    },
    {
      id: 'hundred_thousand_sqm',
      title: 'Territory King',
      description: 'Capture 100,000m² of territory',
      icon: 'star',
      color: AchievementColors.purple,
      unlocked: totalArea >= 100_000,
    },
    {
      id: 'five_km',
      title: '5K Runner',
      description: 'Run 5km total',
      icon: 'walk',
      color: AchievementColors.green,
      unlocked: totalDistance >= 5000,
    },
    {
      id: 'ten_km',
      title: '10K Club',
      description: 'Cover 10km total',
      icon: 'footsteps',
      color: AchievementColors.blue,
      unlocked: totalDistance >= 10000,
    },
    {
      id: 'fifty_km',
      title: 'Half Century',
      description: 'Cover 50km total',
      icon: 'bicycle',
      color: AchievementColors.orange,
      unlocked: totalDistance >= 50000,
    },
    {
      id: 'week_streak',
      title: 'Week Warrior',
      description: 'Active 7 different days',
      icon: 'calendar',
      color: AchievementColors.red,
      unlocked: uniqueDays >= 7,
    },
  ];

  return achievements;
}

export function getUnlockedCount(achievements: Achievement[]): number {
  return achievements.filter((a) => a.unlocked).length;
}
