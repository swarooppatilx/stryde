type Point = readonly [number, number];

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Ramer–Douglas–Peucker: keeps the points that matter to the shape, dropping any that sit within
 * `tolerance` of the line through their neighbours. The ends always stay.
 */
export function simplifyPath<T extends Point>(points: readonly T[], tolerance: number): T[] {
  if (points.length <= 2) return [...points];
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let worst = -1;
    let worstDistance = 0;
    for (let i = first + 1; i < last; i++) {
      const d = distanceToSegment(points[i] as T, points[first] as T, points[last] as T);
      if (d > worstDistance) {
        worstDistance = d;
        worst = i;
      }
    }
    if (worst !== -1 && worstDistance > tolerance) {
      keep[worst] = true;
      stack.push([first, worst], [worst, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Simplifies harder and harder until at most `maxPoints` are left. */
export function simplifyToCount<T extends Point>(
  points: readonly T[],
  maxPoints: number,
  startTolerance = 4
): T[] {
  let tolerance = startTolerance;
  let out = simplifyPath(points, tolerance);
  while (out.length > maxPoints && tolerance < 1e6) {
    tolerance *= 1.6;
    out = simplifyPath(points, tolerance);
  }
  return out;
}
