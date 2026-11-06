type Point = readonly [number, number];

function parse(polyline: string): Array<{ point: Point; raw: string }> {
  if (!polyline) return [];
  const out: Array<{ point: Point; raw: string }> = [];
  for (const raw of polyline.split(';')) {
    const [lng, lat] = raw.split(',').map(Number);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      out.push({ point: [lng as number, lat as number], raw });
    }
  }
  return out;
}

/** Squared distance from p to the segment a-b, in degrees (fine at the scale of one run). */
function segmentDistance2(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  const ex = a[0] + t * dx - p[0];
  const ey = a[1] + t * dy - p[1];
  return ex * ex + ey * ey;
}

/** Ramer-Douglas-Peucker: the indices to keep, iterative so a long run cannot overflow the stack. */
function keepIndices(points: readonly Point[], epsilon2: number): number[] {
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let worst = -1;
    let worstDistance = epsilon2;
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance2(points[i] as Point, points[first] as Point, points[last] as Point);
      if (d > worstDistance) {
        worst = i;
        worstDistance = d;
      }
    }
    if (worst !== -1) {
      keep[worst] = 1;
      stack.push([first, worst], [worst, last]);
    }
  }
  return [...keep.keys()].filter((i) => keep[i]);
}

/**
 * Thins a `lng,lat;lng,lat` route to at most `maxPoints` points, keeping the first and last point
 * and the corners that matter, so a feed card can draw a long run without carrying every fix. Kept
 * points are the original strings, never recomputed ones. A route already short enough is returned
 * untouched.
 */
export function simplifyPolyline(polyline: string, maxPoints: number): string {
  const parsed = parse(polyline);
  if (parsed.length === 0) return '';
  if (parsed.length <= maxPoints) return parsed.map((p) => p.raw).join(';');

  const points = parsed.map((p) => p.point);
  // No single tolerance is known to give `maxPoints` points, so bisect it: 0 keeps every point and
  // one degree keeps only the two ends, which brackets every real route.
  let low = 0;
  let high = 1;
  let best = keepIndices(points, high * high);
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    const kept = keepIndices(points, mid * mid);
    if (kept.length <= maxPoints) {
      best = kept;
      high = mid;
    } else {
      low = mid;
    }
  }
  return best.map((i) => (parsed[i] as { raw: string }).raw).join(';');
}
