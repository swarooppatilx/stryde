import { parsePolyline } from './format';

type LngLat = [number, number];

/**
 * Where a map should first be drawn: the current fix, else where the latest recorded activity
 * started, else the default. The camera takes over once a fix arrives.
 */
export function startingCenter(
  location: { latitude: number; longitude: number } | null,
  activities: readonly { polyline: string }[],
  fallback: LngLat
): LngLat {
  if (location) return [location.longitude, location.latitude];
  for (const activity of activities) {
    const start = parsePolyline(activity.polyline)[0];
    if (start) return start;
  }
  return fallback;
}
