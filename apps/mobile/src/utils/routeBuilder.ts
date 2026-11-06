import { haversineDistance } from '@/utils/geo';
import type { RoutePoint } from '@/utils/route';

/** Length in metres of straight lines joining the points in order. */
export function waypointsDistance(points: readonly RoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as RoutePoint;
    const b = points[i] as RoutePoint;
    total += haversineDistance(a[1], a[0], b[1], b[0]);
  }
  return total;
}

/**
 * Points along the straight legs about `stepM` apart, so an elevation lookup sees the ground
 * between waypoints, not only under them. Both ends of every leg stay; the total is capped.
 */
export function sampleAlong(points: readonly RoutePoint[], stepM: number, max = 200): RoutePoint[] {
  if (points.length < 2) return [...points];
  const total = waypointsDistance(points);
  const step = Math.max(stepM, total / Math.max(max - points.length, 1));
  const out: RoutePoint[] = [points[0] as RoutePoint];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as RoutePoint;
    const b = points[i] as RoutePoint;
    const parts = Math.ceil(haversineDistance(a[1], a[0], b[1], b[0]) / step);
    for (let n = 1; n < parts; n++) {
      const t = n / parts;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    out.push(b);
  }
  return out;
}
