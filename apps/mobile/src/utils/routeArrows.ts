export interface Arrow {
  x: number;
  y: number;
  /** Degrees, 0 = east and 90 = south (svg space, y grows downward). */
  angle: number;
}

/**
 * Evenly spaced direction arrows along a route drawn in svg space, like chevrons along a
 * route line. The first and last fraction of the route is left clear, where the start and end
 * markers sit. Returns none when the route is shorter than `minLength`, where arrows would only clutter.
 */
export function routeArrows(
  points: ReadonlyArray<{ x: number; y: number }>,
  count: number,
  minLength = 60
): Arrow[] {
  if (points.length < 2 || count < 1) return [];

  // Cumulative length at each point, skipping repeats so a standstill adds nothing.
  const segments: Array<{
    from: (typeof points)[number];
    to: (typeof points)[number];
    start: number;
    length: number;
  }> = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1] as (typeof points)[number];
    const to = points[i] as (typeof points)[number];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length === 0) continue;
    segments.push({ from, to, start: total, length });
    total += length;
  }
  if (total < minLength || segments.length === 0) return [];

  const arrows: Arrow[] = [];
  let index = 0;
  for (let k = 1; k <= count; k++) {
    const target = (total * k) / (count + 1);
    while (
      index < segments.length - 1 &&
      (segments[index] as { start: number; length: number }).start +
        (segments[index] as { length: number }).length <
        target
    ) {
      index++;
    }
    const s = segments[index] as (typeof segments)[number];
    const t = Math.min(1, Math.max(0, (target - s.start) / s.length));
    arrows.push({
      x: s.from.x + (s.to.x - s.from.x) * t,
      y: s.from.y + (s.to.y - s.from.y) * t,
      angle: (Math.atan2(s.to.y - s.from.y, s.to.x - s.from.x) * 180) / Math.PI,
    });
  }
  return arrows;
}
