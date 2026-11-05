import { haversineMeters, type LatLng, pathDistanceMeters, type TimedPoint } from './geo.js';

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
const MIN_COVERAGE_RATIO = 0.8;
/** ...and at most this multiple of it (looping around the block isn't a segment effort). */
const MAX_COVERAGE_RATIO = 1.6;

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
    const startPoint = track[i]!;
    if (haversineMeters(startPoint, segment.start) > gateRadiusM) continue;

    let covered = 0;
    for (let j = i + 1; j < track.length; j++) {
      const point = track[j]!;
      covered += haversineMeters(track[j - 1]!, point);
      if (covered > segment.distanceM * MAX_COVERAGE_RATIO) break;
      if (haversineMeters(point, segment.end) > gateRadiusM) continue;
      if (covered < segment.distanceM * MIN_COVERAGE_RATIO) continue;

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
