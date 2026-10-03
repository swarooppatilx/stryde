import { SPORT_TYPES } from '@/constants/activity';
import type { ActivityType } from '@/types';

const GROUPS: { title: string; types: readonly ActivityType[] }[] = [
  { title: 'Foot', types: ['run', 'walk', 'hike'] },
  { title: 'Cycle', types: ['ride'] },
  { title: 'Water', types: ['swim', 'row'] },
  { title: 'Winter', types: [] },
  { title: 'Other', types: ['skate', 'climb', 'workout', 'hiit', 'yoga', 'dance'] },
];

interface Logged {
  activityType: ActivityType;
  createdAt: Date | string | number;
}

/**
 * The two sports for the shortcut cards: the last one used, then the most used of the rest. Sports the
 * athlete picked at setup stand in where history has nothing to say; Run and Ride fill what is left.
 */
export function shortcutSports(
  history: readonly Logged[],
  preferred: readonly ActivityType[] = []
): [ActivityType, ActivityType] {
  const counts = new Map<ActivityType, number>();
  let last: { type: ActivityType; at: number } | null = null;
  for (const { activityType, createdAt } of history) {
    counts.set(activityType, (counts.get(activityType) ?? 0) + 1);
    const at = new Date(createdAt).getTime();
    if (!last || at > last.at) last = { type: activityType, at };
  }
  const first = last?.type ?? preferred[0] ?? 'run';
  const byUse = [...counts.entries()]
    .filter(([type]) => type !== first)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);
  const second =
    byUse[0] ?? preferred.find((type) => type !== first) ?? (first === 'run' ? 'ride' : 'run');
  return [first, second];
}

/** Sports grouped for the full list and narrowed by a search over their names; groups with nothing in them are dropped. */
export function groupSports(query: string) {
  const needle = query.trim().toLowerCase();
  return GROUPS.map(({ title, types }) => ({
    title,
    sports: SPORT_TYPES.filter(
      (sport) => types.includes(sport.type) && sport.label.toLowerCase().includes(needle)
    ),
  })).filter((group) => group.sports.length > 0);
}
