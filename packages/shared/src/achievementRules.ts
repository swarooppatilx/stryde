import type { ActivityType } from './types';

export interface AchievementStats {
  activityCount: number;
  /** Meters, any sport. */
  totalDistance: number;
  /** Meters, runs only. */
  runDistance: number;
  /** Distinct UTC days with at least one activity. */
  activeDays: number;
  /** Square meters of territory held. */
  territoryArea: number;
}

export interface AchievementRule {
  id: string;
  /** Onchain achievement name. */
  name: string;
  unlocked(stats: AchievementStats): boolean;
}

/**
 * The single list of achievements and what earns them. The app shows them; the relay
 * mints a badge only when the athlete's onchain record meets the rule.
 */
export const ACHIEVEMENT_RULES: readonly AchievementRule[] = [
  { id: 'first_activity', name: 'First Activity', unlocked: (s) => s.activityCount >= 1 },
  { id: 'five_activities', name: 'Getting Started', unlocked: (s) => s.activityCount >= 5 },
  { id: 'ten_activities', name: 'Dedicated', unlocked: (s) => s.activityCount >= 10 },
  { id: 'first_territory', name: 'Territory Pioneer', unlocked: (s) => s.territoryArea > 0 },
  { id: 'ten_thousand_sqm', name: 'Map Maker', unlocked: (s) => s.territoryArea >= 10_000 },
  {
    id: 'hundred_thousand_sqm',
    name: 'Territory King',
    unlocked: (s) => s.territoryArea >= 100_000,
  },
  // "5K Runner" is about running; the other distance badges count any sport.
  { id: 'five_km', name: '5K Runner', unlocked: (s) => s.runDistance >= 5_000 },
  { id: 'ten_km', name: '10K Club', unlocked: (s) => s.totalDistance >= 10_000 },
  { id: 'fifty_km', name: 'Half Century', unlocked: (s) => s.totalDistance >= 50_000 },
  { id: 'week_streak', name: 'Week Warrior', unlocked: (s) => s.activeDays >= 7 },
];

/**
 * `isManual` entries (typed in, not recorded by GPS) count as activities and active days,
 * so an indoor session still earns the "showing up" badges, but their distance never
 * counts toward distance badges.
 */
export function achievementStats(
  activities: ReadonlyArray<{
    distance: number;
    activityType: ActivityType;
    timestamp: number;
    isManual?: boolean;
  }>,
  territoryArea: number
): AchievementStats {
  const recorded = activities.filter((a) => !a.isManual);
  return {
    activityCount: activities.length,
    totalDistance: recorded.reduce((sum, a) => sum + a.distance, 0),
    runDistance: recorded
      .filter((a) => a.activityType === 'run')
      .reduce((sum, a) => sum + a.distance, 0),
    activeDays: new Set(activities.map((a) => Math.floor(a.timestamp / 86_400))).size,
    territoryArea,
  };
}

export function unlockedAchievementIds(stats: AchievementStats): string[] {
  return ACHIEVEMENT_RULES.filter((r) => r.unlocked(stats)).map((r) => r.id);
}
