import { haversineDistance } from './geo';

type Point = [number, number];

export interface ColorSegment {
  coordinates: Point[];
  color: string;
}

/** The point `at` metres along the line, given the running length at each vertex. */
function pointAt(line: Point[], lengths: number[], at: number): { point: Point; leg: number } {
  for (let i = 1; i < line.length; i++) {
    const from = lengths[i - 1] as number;
    const to = lengths[i] as number;
    if (at <= to || i === line.length - 1) {
      const span = to - from;
      const mix = span > 0 ? Math.min(1, Math.max(0, (at - from) / span)) : 0;
      const a = line[i - 1] as Point;
      const b = line[i] as Point;
      return { point: [a[0] + (b[0] - a[0]) * mix, a[1] + (b[1] - a[1]) * mix], leg: i };
    }
  }
  return { point: line[0] as Point, leg: 1 };
}

/** Metres from the start of the line to each vertex; the last entry is the line's length. */
function runningLengths(line: readonly Point[]): number[] {
  const lengths: number[] = [0];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as Point;
    const b = line[i] as Point;
    lengths.push((lengths[i - 1] as number) + haversineDistance(a[1], a[0], b[1], b[0]));
  }
  return lengths;
}

/**
 * A route line cut into pieces, each taking the colour of the stop it starts at: stops are
 * (progress, colour) pairs from 0 to 1 along the line's length. Pieces share their end points, so
 * the line has no gaps. Empty when there is no line to cut.
 */
export function colorSegments(
  line: readonly Point[],
  stops: ReadonlyArray<{ progress: number; color: string }>
): ColorSegment[] {
  if (line.length < 2 || stops.length < 2) return [];
  const lengths = runningLengths(line);
  const total = lengths.at(-1) ?? 0;
  if (total <= 0) return [];

  const vertices = [...line] as Point[];
  const segments: ColorSegment[] = [];
  for (let s = 0; s < stops.length - 1; s++) {
    const start = pointAt(vertices, lengths, (stops[s] as { progress: number }).progress * total);
    const end = pointAt(vertices, lengths, (stops[s + 1] as { progress: number }).progress * total);
    const inside = vertices.slice(start.leg, end.leg);
    segments.push({
      coordinates: [start.point, ...inside, end.point],
      color: (stops[s] as { color: string }).color,
    });
  }
  return segments;
}

/**
 * The [lng, lat] `atMeters` along a line: where the scrub cursor sits on the map for the
 * distance the chart reports at that moment. Null when there is no route to point at;
 * distances outside the line clamp to its ends.
 */
export function pointAlongRoute(line: readonly Point[], atMeters: number): Point | null {
  if (line.length < 2) return null;
  const lengths = runningLengths(line);
  return pointAt([...line], lengths, atMeters).point;
}

/**
 * The [lng, lat] at each fraction (0 to 1) of the line's length, measuring the line once.
 * Empty when there is no line to point at.
 */
export function pointsAtFractions(line: readonly Point[], fractions: readonly number[]): Point[] {
  if (line.length < 2) return [];
  const lengths = runningLengths(line);
  const total = lengths.at(-1) ?? 0;
  if (total <= 0) return [];
  const vertices = [...line];
  return fractions.map((f) => pointAt(vertices, lengths, f * total).point);
}
