import { ACHIEVEMENT_RULES, achievementStats } from '@repo/shared';
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

/** How each badge looks; what earns it lives in `@repo/shared` so the relay checks the same rule. */
const PRESENTATION: Record<string, { description: string; icon: string; color: string }> = {
  first_activity: {
    description: 'Complete your first activity',
    icon: 'flag',
    color: AchievementColors.green,
  },
  five_activities: {
    description: 'Complete 5 activities',
    icon: 'flame',
    color: AchievementColors.orange,
  },
  ten_activities: {
    description: 'Complete 10 activities',
    icon: 'trophy',
    color: AchievementColors.yellow,
  },
  first_territory: {
    description: 'Capture your first territory',
    icon: 'map',
    color: AchievementColors.blue,
  },
  ten_thousand_sqm: {
    description: 'Capture 10,000m² of territory',
    icon: 'globe',
    color: AchievementColors.indigo,
  },
  hundred_thousand_sqm: {
    description: 'Capture 100,000m² of territory',
    icon: 'star',
    color: AchievementColors.purple,
  },
  five_km: { description: 'Run 5km total', icon: 'walk', color: AchievementColors.green },
  ten_km: { description: 'Cover 10km total', icon: 'footsteps', color: AchievementColors.blue },
  fifty_km: { description: 'Cover 50km total', icon: 'bicycle', color: AchievementColors.orange },
  week_streak: {
    description: 'Active 7 different days',
    icon: 'calendar',
    color: AchievementColors.red,
  },
};

export function computeAchievements(activities: Activity[], totalArea: number): Achievement[] {
  const stats = achievementStats(
    activities.map((a) => ({
      distance: a.distance,
      activityType: a.activityType,
      timestamp: new Date(a.createdAt).getTime() / 1000,
      isManual: a.isManual,
    })),
    totalArea
  );
  return ACHIEVEMENT_RULES.map((rule) => {
    const look = PRESENTATION[rule.id] ?? {
      description: '',
      icon: 'ribbon',
      color: AchievementColors.blue,
    };
    return { id: rule.id, title: rule.name, ...look, unlocked: rule.unlocked(stats) };
  });
}

/**
 * Which achievements each activity earned: the ones unlocked once it is counted (in date order)
 * that were not unlocked before it. Keyed by activity id; activities that earned nothing are left out.
 * Territory counts what the activities up to that point had claimed.
 */
export function achievementsEarnedBy(activities: readonly Activity[]): Map<string, Achievement[]> {
  const ordered = [...activities].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const earned = new Map<string, Achievement[]>();
  let before = new Set<string>();
  let area = 0;
  ordered.forEach((activity, index) => {
    area += activity.territoryArea ?? 0;
    const now = computeAchievements(ordered.slice(0, index + 1), area).filter((a) => a.unlocked);
    const fresh = now.filter((a) => !before.has(a.id));
    if (fresh.length > 0) earned.set(activity.id, fresh);
    before = new Set(now.map((a) => a.id));
  });
  return earned;
}
