export interface RoutePoint {
  latitude: number;
  longitude: number;
}

/**
 * Shifts a route so it starts at `anchor`, keeping its shape. Routes here span a few hundred metres
 * to a few kilometres, where a plain offset in degrees is exact enough.
 */
export function anchorRoute<T extends RoutePoint>(
  points: readonly T[],
  anchor: RoutePoint | null
): readonly T[] {
  const first = points[0];
  if (!anchor || !first) return points;
  const dLat = anchor.latitude - first.latitude;
  const dLng = anchor.longitude - first.longitude;
  return points.map((p) => ({ ...p, latitude: p.latitude + dLat, longitude: p.longitude + dLng }));
}
