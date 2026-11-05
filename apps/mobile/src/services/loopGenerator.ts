import {
  type DirectionsOptions,
  type DirectionsProfile,
  fetchSnappedLine,
} from '@/services/directions';
import { loopBearings, loopWaypoints, PATH_WIND_FACTOR } from '@/utils/loopRoutes';
import type { RoutePoint } from '@/utils/route';

export interface LoopSuggestion {
  /** The direction the loop heads off in, degrees from north. */
  bearing: number;
  /** Editable waypoints, start and finish included. */
  waypoints: RoutePoint[];
  /** The loop along the paths. */
  line: RoutePoint[];
  distance: number;
}

/** A loop within this share of the target is close enough not to redraw. */
const TOLERANCE = 0.12;

async function oneLoop(
  start: RoutePoint,
  targetM: number,
  bearing: number,
  profile: DirectionsProfile,
  options: DirectionsOptions
): Promise<LoopSuggestion | null> {
  let wind = PATH_WIND_FACTOR;
  let best: LoopSuggestion | null = null;
  // Draw, measure along the paths, and once more at a corrected size if it came out wrong.
  for (let attempt = 0; attempt < 2; attempt++) {
    const waypoints = loopWaypoints(start, targetM, bearing, 3, wind);
    const snapped = await fetchSnappedLine(waypoints, profile, options);
    if (!snapped || snapped.distance <= 0) return best;
    const candidate = { bearing, waypoints, line: snapped.coordinates, distance: snapped.distance };
    if (!best || Math.abs(candidate.distance - targetM) < Math.abs(best.distance - targetM)) {
      best = candidate;
    }
    const ratio = targetM / snapped.distance;
    if (Math.abs(ratio - 1) <= TOLERANCE) break;
    wind /= ratio;
  }
  return best;
}

/**
 * Three loops of about `targetM` from `start`, heading off in different directions along paths
 * for the sport, closest to the distance first. `seed` turns the directions for "show others".
 */
export async function generateLoops(
  start: RoutePoint,
  targetM: number,
  profile: DirectionsProfile,
  seed: number,
  options: DirectionsOptions
): Promise<LoopSuggestion[]> {
  const loops = await Promise.all(
    loopBearings(seed).map((bearing) =>
      oneLoop(start, targetM, bearing, profile, options).catch(() => null)
    )
  );
  return loops
    .filter((loop): loop is LoopSuggestion => loop !== null)
    .sort((a, b) => Math.abs(a.distance - targetM) - Math.abs(b.distance - targetM));
}

const COMPASS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
];

/** "Heads north-east" for a bearing in degrees. */
export function headingWords(bearing: number): string {
  const index = Math.round((((bearing % 360) + 360) % 360) / 45) % 8;
  return `Heads ${COMPASS[index]}`;
}
