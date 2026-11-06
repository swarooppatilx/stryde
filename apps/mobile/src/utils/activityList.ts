import type { Activity, ActivityPrivacy, ActivityType } from '@/types';

export type DateRange = '7d' | '30d' | '90d' | 'year' | 'all';

export const DATE_RANGES: readonly { value: DateRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All' },
];

export interface ActivityListFilter {
  query: string;
  sport: ActivityType | 'all';
  range: DateRange;
}

const DAY_MS = 86_400_000;
const RANGE_DAYS: Record<'7d' | '30d' | '90d', number> = { '7d': 7, '30d': 30, '90d': 90 };

const startedAt = (a: Activity) => a.stream?.startedAt ?? new Date(a.createdAt).getTime();

function rangeStart(range: DateRange, now: Date): number {
  if (range === 'all') return Number.NEGATIVE_INFINITY;
  if (range === 'year') return new Date(now.getFullYear(), 0, 1).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // Today counts as the first of the days, so "7 days" is today and the six before it.
  return today - (RANGE_DAYS[range] - 1) * DAY_MS;
}

/** The athlete's activities that match the title, sport and date range, newest first. */
export function filterActivities(
  activities: readonly Activity[],
  { query, sport, range }: ActivityListFilter,
  now: Date
): Activity[] {
  const needle = query.trim().toLowerCase();
  const from = rangeStart(range, now);
  return activities
    .filter((a) => {
      if (sport !== 'all' && a.activityType !== sport) return false;
      if (needle && !(a.name || 'Activity').toLowerCase().includes(needle)) return false;
      return startedAt(a) >= from;
    })
    .sort((a, b) => startedAt(b) - startedAt(a));
}

/** `ids` with `id` added, or taken out if it was there. */
export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** Which of the chosen activities are not already at this privacy setting. */
export function needsPrivacyChange(
  activities: readonly Activity[],
  ids: readonly string[],
  privacy: ActivityPrivacy
): string[] {
  return activities
    .filter((a) => ids.includes(a.id) && (a.privacy ?? 'everyone') !== privacy)
    .map((a) => a.id);
}

/** How many of the chosen activities already have a copy in the public record. */
export function alreadyPublicCount(
  activities: readonly Activity[],
  ids: readonly string[]
): number {
  return activities.filter((a) => ids.includes(a.id) && a.onchainActivityId).length;
}
