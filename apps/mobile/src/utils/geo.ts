import type { Location } from '../types';

/** Great-circle distance between two coordinates, in meters. */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/** Speed in m/s between two timed locations. Returns 0 if timestamps are equal. */
function speedBetween(a: Location, b: Location): number {
  const dt = (b.timestamp - a.timestamp) / 1000;
  if (dt <= 0) return 0;
  return haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude) / dt;
}

/**
 * Reject GPS outliers based on accuracy and speed sanity.
 *
 * - Drops fixes with reported accuracy > 30 m (low-confidence).
 * - Drops fixes that imply impossible speed (> 25 km/h for a runner).
 */
export function rejectOutliers(locations: Location[]): Location[] {
  const MAX_ACCURACY = 30;
  const MAX_SPEED_MS = 25 / 3.6; // 25 km/h → m/s

  return locations.filter((loc, i) => {
    if (loc.accuracy > MAX_ACCURACY) return false;
    if (i > 0) {
      const speed = speedBetween(locations[i - 1], loc);
      if (speed > MAX_SPEED_MS) return false;
    }
    return true;
  });
}

/**
 * Accuracy-weighted moving average over a sliding window.
 *
 * Each point's weight is `1 / accuracy` (in meters). Low-accuracy fixes
 * contribute less to the smoothed position. Window size is 5 points.
 */
export function smoothLocations(locations: Location[]): Location[] {
  if (locations.length < 3) return locations;

  const WINDOW = 5;
  const smoothed: Location[] = [];

  for (let i = 0; i < locations.length; i++) {
    const start = Math.max(0, i - Math.floor(WINDOW / 2));
    const end = Math.min(locations.length - 1, i + Math.floor(WINDOW / 2));
    let weightSum = 0;
    let lngSum = 0;
    let latSum = 0;

    for (let j = start; j <= end; j++) {
      const w = locations[j].accuracy > 0 ? 1 / locations[j].accuracy : 1;
      weightSum += w;
      lngSum += locations[j].longitude * w;
      latSum += locations[j].latitude * w;
    }

    smoothed.push({
      latitude: latSum / weightSum,
      longitude: lngSum / weightSum,
      timestamp: locations[i].timestamp,
      accuracy: locations[i].accuracy,
    });
  }

  return smoothed;
}
