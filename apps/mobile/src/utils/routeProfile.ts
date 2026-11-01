import { climbAndDescent } from '@/utils/elevation';
import type { RoutePoint } from '@/utils/route';
import { waypointsDistance } from '@/utils/routeBuilder';

export interface RouteProfile {
  values: number[];
  /** Metres along the route of each value. */
  times: number[];
  /** Length of the route in metres. */
  total: number;
  gain: number;
  loss: number;
}

/**
 * Elevations laid out along a line for the elevation chart. A lookup may return fewer values than
 * the line has points, so they are spread evenly over its length.
 */
export function routeProfile(
  line: readonly RoutePoint[],
  elevations: readonly number[]
): RouteProfile | null {
  const total = waypointsDistance(line);
  if (elevations.length < 2 || total <= 0) return null;
  const times =
    elevations.length === line.length
      ? line.map((_, i) => waypointsDistance(line.slice(0, i + 1)))
      : elevations.map((_, i) => (i / (elevations.length - 1)) * total);
  const { gain, loss } = climbAndDescent(elevations, { resetOnJump: false });
  return { values: [...elevations], times, total, gain: Math.round(gain), loss: Math.round(loss) };
}
