import type { HiddenStat } from '@/types';

export type MapVisibility = 'show' | 'ends' | 'hide';

export const HIDDEN_STAT_CHOICES: ReadonlyArray<{ stat: HiddenStat; label: string }> = [
  { stat: 'start_time', label: 'Start time' },
  { stat: 'pace', label: 'Pace' },
];

const KNOWN_STATS = new Set<HiddenStat>(HIDDEN_STAT_CHOICES.map((c) => c.stat));

/** Drops anything that is not a stat the app can hide, and repeats. */
export function sanitizeHiddenStats(value: unknown): HiddenStat[] {
  if (!Array.isArray(value)) return [];
  return HIDDEN_STAT_CHOICES.map((c) => c.stat).filter((stat) => value.includes(stat));
}

export const isKnownHiddenStat = (stat: string): stat is HiddenStat =>
  KNOWN_STATS.has(stat as HiddenStat);

/** The one choice the two stored switches add up to. */
export function mapVisibilityOf(settings: {
  defaultHideRoute: boolean;
  hideRouteEnds: boolean;
}): MapVisibility {
  if (settings.defaultHideRoute) return 'hide';
  return settings.hideRouteEnds ? 'ends' : 'show';
}

/**
 * The stored switches for a choice. Hiding the whole route keeps the ends hidden too, so an
 * activity brought in from a file, which has no route switch of its own, is still cut at its ends.
 */
export function switchesForMapVisibility(choice: MapVisibility): {
  defaultHideRoute: boolean;
  hideRouteEnds: boolean;
} {
  return {
    defaultHideRoute: choice === 'hide',
    hideRouteEnds: choice !== 'show',
  };
}
