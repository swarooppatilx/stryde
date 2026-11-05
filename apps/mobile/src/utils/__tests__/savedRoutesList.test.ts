import { describe, expect, it } from 'vitest';
import { COLLAPSED_ROUTE_COUNT, visibleSavedRoutes } from '@/utils/savedRoutesList';

const routes = Array.from({ length: 9 }, (_, i) => ({ id: `r${i}` }));

describe('visibleSavedRoutes', () => {
  it('shows a short preview while the sheet is collapsed', () => {
    expect(visibleSavedRoutes(routes, false).map((r) => r.id)).toEqual(['r0', 'r1']);
    expect(COLLAPSED_ROUTE_COUNT).toBe(2);
  });

  it('shows every saved route once the sheet is open, so a sixth one can still be reached and removed', () => {
    expect(visibleSavedRoutes(routes, true)).toHaveLength(9);
  });

  it('keeps the newest first and does not change the list it was given', () => {
    const copy = [...routes];

    visibleSavedRoutes(routes, true);

    expect(routes).toEqual(copy);
  });

  it('copes with having fewer routes than the preview shows', () => {
    expect(visibleSavedRoutes([{ id: 'only' }], false)).toEqual([{ id: 'only' }]);
    expect(visibleSavedRoutes([], true)).toEqual([]);
  });
});
