import type { ActivityType } from '@/types';

export type RouteDifficulty = 'easy' | 'moderate' | 'hard';

export const DIFFICULTY_LABEL: Record<RouteDifficulty, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
};

/** Where the effort score (flat-kilometre equivalents) turns moderate and hard. */
const MODERATE_FROM = 8;
const HARD_FROM = 15;
/** Naismith's rule, loosely: 100 m climbed costs about as much as 1.7 more flat kilometres. */
const METRES_CLIMB_PER_KM = 60;
/** Cycling covers ground about four times as fast, so a ride's distance counts for a quarter. */
const CYCLING_DISTANCE_WEIGHT = 1 / 4;
const CYCLING_SPORTS = new Set<string>(['ride']);

/**
 * How demanding a route is, from its length and climb. Null when the climb is unknown: calling a route
 * easy from distance alone would be a guess dressed as a fact.
 */
export function routeDifficulty(route: {
  distance: number;
  elevationGain?: number;
  sport: ActivityType | string;
}): RouteDifficulty | null {
  if (route.elevationGain === undefined) return null;
  const weight = CYCLING_SPORTS.has(route.sport) ? CYCLING_DISTANCE_WEIGHT : 1;
  const effort = (route.distance / 1000) * weight + route.elevationGain / METRES_CLIMB_PER_KM;
  if (effort >= HARD_FROM) return 'hard';
  return effort >= MODERATE_FROM ? 'moderate' : 'easy';
}

export type ElevationFilter = 'any' | 'flat' | 'rolling' | 'hilly';

/** Where the bands split, in metres of total climb. */
export const FLAT_MAX = 50;
export const ROLLING_MAX = 200;

export function inElevationBand(filter: ElevationFilter, gain: number | undefined): boolean {
  if (filter === 'any') return true;
  if (gain === undefined) return false;
  switch (filter) {
    case 'flat':
      return gain < FLAT_MAX;
    case 'rolling':
      return gain >= FLAT_MAX && gain < ROLLING_MAX;
    case 'hilly':
      return gain >= ROLLING_MAX;
  }
}
