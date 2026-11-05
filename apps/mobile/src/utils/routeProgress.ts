import type { RoutePoint } from '@/utils/route';

const METRES_PER_DEGREE = 111_320;

export interface RouteProgress {
  /** Straight-line distance from the athlete to the nearest point of the route. */
  offsetM: number;
  /** How far along the route that nearest point is. */
  alongM: number;
  totalM: number;
  remainingM: number;
}

/** Metres from the start to each point of the line, in the same flat projection as the progress. */
export function cumulativeLengths(line: readonly RoutePoint[]): number[] {
  const out = [0];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as RoutePoint;
    const b = line[i] as RoutePoint;
    const kx = METRES_PER_DEGREE * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
    out.push(
      (out[i - 1] as number) + Math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * METRES_PER_DEGREE)
    );
  }
  return out;
}

/**
 * Where the athlete is against a planned route: the nearest point on it, how far along that is,
 * and how far away they are. `lastAlongM` keeps a loop or out-and-back from snapping back to the
 * start when the line passes the same spot twice: nearby candidates ahead of it win ties.
 */
export function routeProgress(
  position: RoutePoint,
  line: readonly RoutePoint[],
  cumulative: readonly number[] = cumulativeLengths(line),
  lastAlongM = 0
): RouteProgress | null {
  if (line.length < 2) return null;
  const totalM = cumulative.at(-1) as number;
  const kx = METRES_PER_DEGREE * Math.cos((position[1] * Math.PI) / 180);
  const project = (p: RoutePoint) =>
    [(p[0] - position[0]) * kx, (p[1] - position[1]) * METRES_PER_DEGREE] as const;

  let best: { offset: number; along: number; score: number } | null = null;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = project(line[i - 1] as RoutePoint);
    const [bx, by] = project(line[i] as RoutePoint);
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lengthSq));
    const offset = Math.hypot(ax + t * dx, ay + t * dy);
    const segStart = cumulative[i - 1] as number;
    const along = segStart + t * ((cumulative[i] as number) - segStart);
    // Going backwards along the route costs a little, so the pass you are on now beats an earlier one.
    const behind = Math.max(0, lastAlongM - along);
    const score = offset + behind * 0.25;
    if (!best || score < best.score) best = { offset, along, score };
  }
  if (!best) return null;
  return {
    offsetM: best.offset,
    alongM: best.along,
    totalM,
    remainingM: Math.max(0, totalM - best.along),
  };
}
