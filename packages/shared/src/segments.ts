/**
 * Segment geometry the app and the API share. The API keeps its own copy in
 * packages/api/src/lib/fitness (it builds without this package); a parity test in the API
 * keeps the two matching.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface TimedPoint extends LatLng {
  /** Unix epoch milliseconds. */
  timestamp: number;
}

export interface SegmentGeometry {
  start: LatLng;
  end: LatLng;
  /** Official segment length; used to reject efforts that took a shortcut. */
  distanceM: number;
}

export interface SegmentEffortMatch {
  startIndex: number;
  endIndex: number;
  startedAt: number;
  elapsedSec: number;
  coveredM: number;
}

export const SEGMENT_GATE_RADIUS_M = 30;
/** An effort must cover at least this share of the segment's length between gates. */
export const SEGMENT_MIN_COVERAGE_RATIO = 0.8;
/** ...and at most this multiple of it (looping around the block isn't a segment effort). */
export const SEGMENT_MAX_COVERAGE_RATIO = 1.6;

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathDistanceMeters(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    if (from && to) total += haversineMeters(from, to);
  }
  return total;
}

/**
 * Finds the fastest pass through a segment in a timed GPS track: the athlete
 * must cross the start gate, then later the end gate, covering a plausible
 * share of the segment length in between. Returns null when no pass qualifies.
 */
export function matchSegmentEffort(
  track: TimedPoint[],
  segment: SegmentGeometry,
  gateRadiusM = SEGMENT_GATE_RADIUS_M
): SegmentEffortMatch | null {
  if (track.length < 2) return null;

  let best: SegmentEffortMatch | null = null;

  for (let i = 0; i < track.length; i++) {
    const startPoint = track[i];
    if (!startPoint) continue;
    if (haversineMeters(startPoint, segment.start) > gateRadiusM) continue;

    let covered = 0;
    for (let j = i + 1; j < track.length; j++) {
      const point = track[j];
      const previous = track[j - 1];
      if (!point || !previous) continue;
      covered += haversineMeters(previous, point);
      if (covered > segment.distanceM * SEGMENT_MAX_COVERAGE_RATIO) break;
      if (haversineMeters(point, segment.end) > gateRadiusM) continue;
      if (covered < segment.distanceM * SEGMENT_MIN_COVERAGE_RATIO) continue;

      const elapsedSec = Math.round((point.timestamp - startPoint.timestamp) / 1000);
      if (elapsedSec > 0 && (!best || elapsedSec < best.elapsedSec)) {
        best = {
          startIndex: i,
          endIndex: j,
          startedAt: startPoint.timestamp,
          elapsedSec,
          coveredM: Math.round(covered),
        };
      }
      break;
    }
  }

  return best;
}

/** Builds segment geometry from a slice of a recorded route. */
export function segmentFromTrack(track: LatLng[]): SegmentGeometry | null {
  const first = track[0];
  const last = track[track.length - 1];
  if (!first || !last || track.length < 2) return null;
  return {
    start: first,
    end: last,
    distanceM: Math.round(pathDistanceMeters(track)),
  };
}

const GEOHASH_ALPHABET = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(latitude: number, longitude: number, precision = 7): string {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let evenBit = true;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (longitude >= mid) {
        ch = (ch << 1) | 1;
        lngMin = mid;
      } else {
        ch <<= 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (latitude >= mid) {
        ch = (ch << 1) | 1;
        latMin = mid;
      } else {
        ch <<= 1;
        latMax = mid;
      }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      hash += GEOHASH_ALPHABET[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}
