import type { Location, Ring } from '@/types';

/** Two points this close (m) close a loop. */
const LOOP_CLOSE_DISTANCE_M = 50;
/** A loop's outline must be at least this long (m); shorter is someone standing about. */
const MIN_LOOP_PERIMETER_M = 100;
/** Smaller than this (m²) is not worth a territory. */
export const MIN_TERRITORY_AREA_M2 = 400;
/** Larger than this (m²) is not something a person ran around in a day. */
export const MAX_TERRITORY_AREA_M2 = 50_000_000;
/** area / perimeter²: a circle is 0.08, a thin out-and-back sliver is near 0. */
const MIN_COMPACTNESS = 0.02;
/** The track is thinned to roughly this tolerance (m) before looking for loops. */
const SIMPLIFY_TOLERANCE_M = 4;
/** Keeps the search for loops bounded however long the run is. */
const MAX_POINTS = 400;

const METERS_PER_DEGREE_LAT = 111_320;

interface Point {
  x: number;
  y: number;
  lat: number;
  lng: number;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function project(locations: readonly Location[]): Point[] {
  const origin = locations[0];
  if (!origin) return [];
  const perLng = METERS_PER_DEGREE_LAT * Math.cos((origin.latitude * Math.PI) / 180);
  return locations.map((l) => ({
    x: (l.longitude - origin.longitude) * perLng,
    y: (l.latitude - origin.latitude) * METERS_PER_DEGREE_LAT,
    lat: l.latitude,
    lng: l.longitude,
  }));
}

/** Douglas-Peucker: drops points that lie within `tolerance` of the line between the kept ones. */
function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const range = stack.pop();
    if (!range) break;
    const [from, to] = range;
    const a = points[from];
    const b = points[to];
    if (!a || !b) continue;
    const length = dist(a, b);
    let farthest = -1;
    let farthestDistance = tolerance;
    for (let i = from + 1; i < to; i++) {
      const p = points[i];
      if (!p) continue;
      const d =
        length === 0
          ? dist(p, a)
          : Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / length;
      if (d > farthestDistance) {
        farthest = i;
        farthestDistance = d;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = true;
      stack.push([from, farthest], [farthest, to]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function thin(points: Point[]): Point[] {
  let tolerance = SIMPLIFY_TOLERANCE_M;
  let result = simplify(points, tolerance);
  while (result.length > MAX_POINTS) {
    tolerance *= 1.5;
    result = simplify(points, tolerance);
  }
  return result;
}

/** Where segments ab and cd cross, if they do (not merely touch at an end). */
function crossing(a: Point, b: Point, c: Point, d: Point): Point | null {
  const denominator = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (denominator === 0) return null;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denominator;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denominator;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  return {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
  };
}

function areaAndPerimeter(ring: Point[]): { area: number; perimeter: number } {
  let twice = 0;
  let perimeter = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    if (!p || !q) continue;
    twice += p.x * q.y - q.x * p.y;
    perimeter += dist(p, q);
  }
  return { area: Math.abs(twice) / 2, perimeter };
}

export interface Loop {
  /** Closed ring of [longitude, latitude], first point repeated at the end. */
  ring: Ring;
  area: number;
}

/**
 * The largest region the track actually closed. A loop is closed when the track crosses itself, or comes back
 * within 50 m of an earlier point; only that stretch is claimed, so a run that closes a loop in the middle claims
 * the loop, a figure of eight claims a lobe (not a cancelled-out total), and an out-and-back claims nothing.
 */
export function findLargestLoop(locations: readonly Location[]): Loop | null {
  const points = thin(project(locations));
  if (points.length < 4) return null;

  let best: { ring: Point[]; area: number } | null = null;
  const consider = (ring: Point[]) => {
    if (ring.length < 3) return;
    const { area, perimeter } = areaAndPerimeter(ring);
    if (area < MIN_TERRITORY_AREA_M2 || area > MAX_TERRITORY_AREA_M2) return;
    if (perimeter < MIN_LOOP_PERIMETER_M) return;
    if (area / (perimeter * perimeter) < MIN_COMPACTNESS) return;
    if (!best || area > best.area) best = { ring, area };
  };

  // Self-crossings: the track from the crossing back around to itself.
  for (let j = 2; j < points.length - 1; j++) {
    const c = points[j];
    const d = points[j + 1];
    if (!c || !d) continue;
    for (let i = 0; i < j - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (!a || !b) continue;
      const at = crossing(a, b, c, d);
      if (at) consider([at, ...points.slice(i + 1, j + 1)]);
    }
  }

  // Coming back close to an earlier point.
  for (let i = 0; i < points.length - 3; i++) {
    const start = points[i];
    if (!start) continue;
    for (let j = i + 3; j < points.length; j++) {
      const end = points[j];
      if (end && dist(start, end) <= LOOP_CLOSE_DISTANCE_M) consider(points.slice(i, j + 1));
    }
  }

  const found = best as { ring: Point[]; area: number } | null;
  if (!found) return null;
  const ring: Ring = found.ring.map((p): [number, number] => [p.lng, p.lat]);
  const first = ring[0];
  if (first) ring.push([first[0], first[1]]);
  return { ring, area: found.area };
}
