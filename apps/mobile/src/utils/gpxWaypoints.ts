import { parseGpx } from '@/utils/gpxParse';
import type { RoutePoint } from '@/utils/route';
import { simplifyPath } from '@/utils/simplifyPath';

/** Search range for the thinning tolerance, in degrees (about a metre up to far beyond any route). */
const MIN_TOLERANCE_DEG = 1e-6;
const MAX_TOLERANCE_DEG = 1;
const SEARCH_STEPS = 30;

/** The most detailed simplification that fits `max` points, found by bisecting the tolerance. */
function thinTo(line: readonly RoutePoint[], max: number): RoutePoint[] {
  if (line.length <= max) return [...line];
  let low = MIN_TOLERANCE_DEG;
  let high = MAX_TOLERANCE_DEG;
  let best = simplifyPath(line, high);
  for (let i = 0; i < SEARCH_STEPS; i++) {
    const mid = Math.sqrt(low * high);
    const candidate = simplifyPath(line, mid);
    if (candidate.length <= max) {
      best = candidate;
      high = mid;
    } else {
      low = mid;
    }
  }
  return best;
}

export interface GpxWaypoints {
  points: RoutePoint[];
  /** Points the file's track had before thinning. */
  original: number;
  /** The track had more points than the builder takes, so its shape was simplified. */
  capped: boolean;
}

/** A GPX track as builder waypoints, thinned to at most `max`; null when the file has no usable track. */
export function waypointsFromGpx(xml: string, max: number): GpxWaypoints | null {
  const parsed = parseGpx(xml);
  if (!parsed) return null;
  const line = parsed.points.map<RoutePoint>((p) => [p.longitude, p.latitude]);
  const points = thinTo(line, Math.max(2, max));
  return { points, original: line.length, capped: line.length > points.length };
}
