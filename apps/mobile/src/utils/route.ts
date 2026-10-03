import { toPolyline } from './format';

export type RoutePoint = [longitude: number, latitude: number];

/** Cap on how many points the live map polyline keeps. */
const MAX_ROUTE_POINTS = 2000;

/** The route line from an activity's IPFS metadata; chain-seeded activities carry only `metadataCid`, so without it the detail map is empty for activities recorded elsewhere. */
export function polylineFromMetadata(
  metadata: {
    polyline?: string;
    coordinates?: unknown;
  } | null
): string {
  if (!metadata) return '';
  if (metadata.polyline) return metadata.polyline;
  const coords = Array.isArray(metadata.coordinates)
    ? metadata.coordinates.filter(
        (c): c is RoutePoint =>
          Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])
      )
    : [];
  return toPolyline(coords);
}

/** Thins a long route evenly, always keeping the first and last points. */
export function downsampleRoute(route: RoutePoint[], max = MAX_ROUTE_POINTS): RoutePoint[] {
  if (route.length <= max) return route;

  const stride = Math.ceil(route.length / max);
  const thinned: RoutePoint[] = [];
  for (let i = 0; i < route.length; i += stride) thinned.push(route[i] as RoutePoint);

  const last = route.at(-1);
  if (last && thinned.at(-1) !== last) thinned.push(last);
  return thinned;
}
