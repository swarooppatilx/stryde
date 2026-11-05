import type { RoutePoint } from '@/utils/route';

/** Further than this from the line and the athlete is off it. */
export const OFF_ROUTE_START_M = 40;
/** Back within this and the athlete is on it again; tighter than the start so GPS wobble at the edge does not flip it. */
export const OFF_ROUTE_BACK_M = 25;

const METRES_PER_DEGREE = 111_320;

export interface OffRouteState {
  off: boolean;
}

/** Shortest distance in metres from a position to a line, in a flat projection that is exact enough at route scale. */
export function distanceToPolyline(position: RoutePoint, line: readonly RoutePoint[]): number {
  const first = line[0];
  if (!first) return Number.POSITIVE_INFINITY;
  const kx = METRES_PER_DEGREE * Math.cos((position[1] * Math.PI) / 180);
  const project = (p: RoutePoint) =>
    [(p[0] - position[0]) * kx, (p[1] - position[1]) * METRES_PER_DEGREE] as const;

  let best = Math.hypot(...project(first));
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = project(line[i - 1] as RoutePoint);
    const [bx, by] = project(line[i] as RoutePoint);
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lengthSq));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/** The next off-route state for the latest distance from the line. */
export function stepOffRoute(state: OffRouteState, distance: number): OffRouteState {
  if (state.off) return distance < OFF_ROUTE_BACK_M ? { off: false } : state;
  return distance > OFF_ROUTE_START_M ? { off: true } : state;
}
