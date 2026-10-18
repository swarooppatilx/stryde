import type { SavedRoute } from '@/stores/routeStore';
import { type DistanceFilter, inDistanceBand } from '@/utils/distanceFilter';
import { SPORT_LABEL } from '@/utils/format';
import {
  type ElevationFilter,
  inElevationBand,
  type RouteDifficulty,
  routeDifficulty,
} from '@/utils/routeDifficulty';

export interface RouteFilters {
  sport: string;
  distance: DistanceFilter;
  starredOnly: boolean;
  /** Left out, every climb passes. */
  elevation?: ElevationFilter;
  /** Left out, every difficulty passes, including routes whose climb is unknown. */
  difficulty?: RouteDifficulty | 'any';
}

type Filterable = Pick<SavedRoute, 'sport' | 'distance' | 'starred' | 'elevationGain'>;

/** Saved routes that pass the filters, starred ones first and the saved order kept inside each group. */
export function filterSavedRoutes<T extends Filterable>(
  routes: readonly T[],
  { sport, distance, starredOnly, elevation = 'any', difficulty = 'any' }: RouteFilters
): T[] {
  const kept = routes.filter(
    (r) =>
      (sport === 'all' || r.sport === sport) &&
      inDistanceBand(distance, r.distance) &&
      inElevationBand(elevation, r.elevationGain) &&
      (difficulty === 'any' || routeDifficulty(r) === difficulty) &&
      (!starredOnly || r.starred === true)
  );
  return [...kept.filter((r) => r.starred), ...kept.filter((r) => !r.starred)];
}

/** How many of the sheet's filters narrow the list; the star toggle has its own chip and is not counted. */
export function activeFilterCount(filters: RouteFilters): number {
  return [
    filters.sport !== 'all',
    filters.distance !== 'any',
    (filters.elevation ?? 'any') !== 'any',
    (filters.difficulty ?? 'any') !== 'any',
  ].filter(Boolean).length;
}

/** Chips for the sports that have a saved route, after All. */
export function routeSportOptions(
  routes: readonly Pick<SavedRoute, 'sport'>[]
): Array<{ value: string; label: string }> {
  const sports = [...new Set(routes.map((r) => r.sport as string))];
  return [
    { value: 'all', label: 'All' },
    ...sports.map((s) => ({ value: s, label: SPORT_LABEL[s] ?? s })),
  ];
}
