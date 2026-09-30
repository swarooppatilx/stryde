import { keccak256, toBytes } from 'viem';
import type { Address, ChainIndex } from './index/types.js';

interface Stats {
  activityCount: number;
  totalDistance: number;
  runDistance: number;
  activeDays: number;
  territoryArea: number;
}

/** Copy of `@repo/shared` `ACHIEVEMENT_RULES` (kept in step by a parity test until A7). */
export const ACHIEVEMENT_RULES: ReadonlyArray<{
  id: string;
  name: string;
  unlocked(stats: Stats): boolean;
}> = [
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
  { id: 'five_km', name: '5K Runner', unlocked: (s) => s.runDistance >= 5_000 },
  { id: 'ten_km', name: '10K Club', unlocked: (s) => s.totalDistance >= 10_000 },
  { id: 'fifty_km', name: 'Half Century', unlocked: (s) => s.totalDistance >= 50_000 },
  { id: 'week_streak', name: 'Week Warrior', unlocked: (s) => s.activeDays >= 7 },
];

/** Onchain activity type 0 is a run (`ACTIVITY_TYPE_MAP` in @repo/shared). */
const RUN = 0;

const RULE_BY_ID = new Map(ACHIEVEMENT_RULES.map((rule) => [keccak256(toBytes(rule.id)), rule]));

async function athleteStats(index: ChainIndex, athlete: Address): Promise<Stats> {
  const [activities, territoryArea] = await Promise.all([
    index.activities(athlete),
    index.activeTerritoryArea(athlete),
  ]);
  return {
    activityCount: activities.length,
    totalDistance: activities.reduce((sum, a) => sum + a.distance, 0),
    runDistance: activities
      .filter((a) => a.activityType === RUN)
      .reduce((sum, a) => sum + a.distance, 0),
    activeDays: new Set(activities.map((a) => Math.floor(a.timestamp / 86_400))).size,
    territoryArea,
  };
}

/** Whether `athlete`'s onchain record earns `achievementId`, and the badge's name. */
export async function checkAchievement(
  index: ChainIndex,
  athlete: Address,
  achievementId: `0x${string}`
): Promise<{ ok: true; name: string } | { ok: false; reason: 'unknown' | 'not_earned' }> {
  const rule = RULE_BY_ID.get(achievementId.toLowerCase() as `0x${string}`);
  if (!rule) return { ok: false, reason: 'unknown' };
  const stats = await athleteStats(index, athlete);
  return rule.unlocked(stats) ? { ok: true, name: rule.name } : { ok: false, reason: 'not_earned' };
}
