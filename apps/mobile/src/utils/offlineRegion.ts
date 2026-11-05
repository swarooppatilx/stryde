import type { RoutePoint } from '@/utils/route';
import { routeBounds } from '@/utils/routeBounds';

/** Zooms an offline route map covers: the whole area down to street level. */
export const OFFLINE_ZOOM = { min: 10, max: 16 } as const;
/** Room kept around the route, so a detour or a wrong turn stays on the map. */
export const OFFLINE_PAD_M = 800;
const METERS_PER_DEGREE = 111_320;

export function offlinePackName(routeId: string): string {
  return `route-${routeId}`;
}

/** The route's box widened by `padM` on every side, as Mapbox wants it: [north-east, south-west]. */
export function offlineBounds(
  line: readonly RoutePoint[],
  padM = OFFLINE_PAD_M
): [[number, number], [number, number]] | null {
  const box = routeBounds(line);
  if (!box) return null;
  const [west, south, east, north] = box;
  const midLat = ((south + north) / 2) * (Math.PI / 180);
  const dLat = padM / METERS_PER_DEGREE;
  const dLng = padM / (METERS_PER_DEGREE * Math.max(Math.cos(midLat), 0.01));
  return [
    [east + dLng, north + dLat],
    [west - dLng, south - dLat],
  ];
}
