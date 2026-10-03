export const COLLAPSED_ROUTE_COUNT = 2;

/**
 * Saved routes the Maps sheet lists. Only the open sheet scrolls, so capping the open list too
 * (it was five) left every route past the cap impossible to reach or remove.
 */
export function visibleSavedRoutes<T>(routes: readonly T[], expanded: boolean): T[] {
  return expanded ? [...routes] : routes.slice(0, COLLAPSED_ROUTE_COUNT);
}
