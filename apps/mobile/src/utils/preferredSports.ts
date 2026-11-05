import { SPORT_TYPES } from '@/constants/activity';
import type { ActivityType } from '@/types';

/** Adds a sport to the end of the picks, or takes it out; the order of picking is the order shown. */
export function toggleSport(picked: readonly ActivityType[], type: ActivityType): ActivityType[] {
  return picked.includes(type) ? picked.filter((t) => t !== type) : [...picked, type];
}

/** Keeps only known sports, once each, so a stale or damaged saved list cannot reach the Record screen. */
export function sanitizePreferredSports(value: unknown): ActivityType[] {
  if (!Array.isArray(value)) return [];
  const known = new Set<string>(SPORT_TYPES.map((s) => s.type));
  const seen = new Set<string>();
  const out: ActivityType[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !known.has(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item as ActivityType);
  }
  return out;
}
