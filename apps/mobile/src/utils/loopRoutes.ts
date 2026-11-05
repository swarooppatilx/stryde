import type { RoutePoint } from '@/utils/route';

const EARTH_RADIUS_M = 6_371_000;
const RAD = Math.PI / 180;

/** The point `distanceM` from `from` in the direction `bearingDeg` (0 = north, clockwise). */
export function destinationPoint(
  from: RoutePoint,
  bearingDeg: number,
  distanceM: number
): RoutePoint {
  const [lng, lat] = from;
  const delta = distanceM / EARTH_RADIUS_M;
  const theta = bearingDeg * RAD;
  const phi1 = lat * RAD;
  const lambda1 = lng * RAD;
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta)
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
    );
  return [((lambda2 / RAD + 540) % 360) - 180, phi2 / RAD];
}

/** Paths wind: a loop along them comes out about this much longer than the circle it was drawn on. */
export const PATH_WIND_FACTOR = 1.3;

/**
 * Waypoints for a loop of roughly `targetM` that heads off in `bearingDeg`: the start, then
 * `ring` points around a circle that passes through the start, then the start again.
 */
export function loopWaypoints(
  start: RoutePoint,
  targetM: number,
  bearingDeg: number,
  ring = 3,
  windFactor = PATH_WIND_FACTOR
): RoutePoint[] {
  const radius = targetM / windFactor / (2 * Math.PI);
  const center = destinationPoint(start, bearingDeg, radius);
  // Walk round the circle from the start, so the loop leaves along the chosen bearing.
  const startAngle = (bearingDeg + 180) % 360;
  const points: RoutePoint[] = [start];
  for (let i = 1; i <= ring; i++) {
    points.push(destinationPoint(center, startAngle + (360 / (ring + 1)) * i, radius));
  }
  points.push(start);
  return points;
}

/** Three directions a third of a turn apart, turned by `seed` so "Try again" gives new loops. */
export function loopBearings(seed: number): number[] {
  const base = (((seed * 47) % 360) + 360) % 360;
  return [base, (base + 120) % 360, (base + 240) % 360];
}

/** Distance presets the generator offers for each sport, in metres. */
export const LOOP_DISTANCES: Record<'run' | 'ride' | 'walk' | 'hike', number[]> = {
  run: [3000, 5000, 10_000, 15_000],
  ride: [20_000, 40_000, 60_000, 100_000],
  walk: [2000, 4000, 6000, 10_000],
  hike: [5000, 10_000, 15_000, 20_000],
};
