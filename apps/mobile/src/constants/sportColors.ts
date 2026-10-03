import type { ActivityType } from '@/types';

/** Per-sport route colours for the map layer; categorical, so they only need to stay distinguishable on light and dark basemaps. */
export const SPORT_ROUTE_COLORS: Record<ActivityType, string> = {
  run: '#22c55e',
  ride: '#3b82f6',
  walk: '#a3e635',
  hike: '#f59e0b',
  swim: '#06b6d4',
  yoga: '#a855f7',
  workout: '#ef4444',
  hiit: '#f97316',
  dance: '#ec4899',
  climb: '#94a3b8',
  skate: '#14b8a6',
  row: '#0ea5e9',
};

export const NEUTRAL_ROUTE_COLOR = '#64748b';

/** The colour an event's cover takes from its sport; a multi-sport event stays neutral. */
export function eventCoverColor(sport: ActivityType | 'multi'): string {
  return sport === 'multi'
    ? NEUTRAL_ROUTE_COLOR
    : (SPORT_ROUTE_COLORS[sport] ?? NEUTRAL_ROUTE_COLOR);
}
