import { NEUTRAL_ROUTE_COLOR, SPORT_ROUTE_COLORS } from '@/constants/sportColors';
import type { ActivityType } from '@/types';

/** Colour for a route of this sport; neutral grey when the sport is unknown. */
export function routeColorFor(sport: string | undefined): string {
  return (sport && SPORT_ROUTE_COLORS[sport as ActivityType]) || NEUTRAL_ROUTE_COLOR;
}

/**
 * For async lookups where only the newest request may update the screen: a slow
 * answer to "pu" must not overwrite the results for "pune".
 */
export function createLatestGate() {
  let latest = 0;
  return {
    next() {
      const mine = ++latest;
      return { isCurrent: () => mine === latest };
    },
    /** Marks every request still in flight as stale. */
    cancel() {
      latest++;
    },
  };
}

/** Each layer is its own switch: "others" doesn't need "my routes" to be on. */
export function visibleRoutes<T>(input: {
  showRoutes: boolean;
  showOthers: boolean;
  own: T[];
  others: T[];
}): T[] {
  return [...(input.showRoutes ? input.own : []), ...(input.showOthers ? input.others : [])];
}
