import {
  haversineMeters,
  SEGMENT_GATE_RADIUS_M,
  SEGMENT_MAX_COVERAGE_RATIO,
  SEGMENT_MIN_COVERAGE_RATIO,
  type TimedPoint,
} from '@repo/shared/segments';

export interface LiveSegment {
  key: string;
  name: string;
  start: { latitude: number; longitude: number };
  end: { latitude: number; longitude: number };
  distanceM: number;
  /** The athlete's own best time on it, when known. */
  prSec: number | null;
  /** The fastest time on its board, when known. */
  leaderSec: number | null;
}

export interface LiveSegmentStatus {
  key: string;
  name: string;
  elapsedSec: number;
  coveredM: number;
  distanceM: number;
  prSec: number | null;
  leaderSec: number | null;
}

interface Attempt {
  startedAt: number;
  coveredM: number;
  last: TimedPoint;
}

/** Degrees of latitude per metre, for the cheap box test before any real distance. */
const DEG_PER_M = 1 / 111_000;
const MAX_ATTEMPTS = 6;

/**
 * Seconds ahead (negative) or behind (positive) a target time, at the same share of the segment:
 * 40% of the way in 100 s against a 300 s target is 20 s behind a 120 s pace.
 */
export function deltaVsTarget(
  elapsedSec: number,
  coveredM: number,
  distanceM: number,
  targetSec: number
): number {
  const share = Math.min(1, Math.max(0, coveredM / distanceM));
  return Math.round(elapsedSec - targetSec * share);
}

/** "-0:12" for ahead, "+0:05" for behind. */
export function formatDelta(deltaSec: number): string {
  const sign = deltaSec < 0 ? '-' : '+';
  const abs = Math.abs(deltaSec);
  const m = Math.floor(abs / 60);
  const s = String(abs % 60).padStart(2, '0');
  return `${sign}${m}:${s}`;
}

/** The line shown while on a segment: the delta against the PR, else the leader, else just the time. */
export function liveSegmentLine(status: LiveSegmentStatus): { title: string; detail: string } {
  const target = targetOf(status);
  if (!target) return { title: status.name, detail: formatClock(status.elapsedSec) };
  const delta = deltaVsTarget(status.elapsedSec, status.coveredM, status.distanceM, target.sec);
  return { title: status.name, detail: `${formatDelta(delta)} vs ${target.label}` };
}

function targetOf(status: LiveSegmentStatus): { sec: number; label: string } | null {
  if (status.prSec !== null) return { sec: status.prSec, label: 'PR' };
  if (status.leaderSec !== null) return { sec: status.leaderSec, label: 'leader' };
  return null;
}

function advance(
  running: Attempt[],
  segment: LiveSegment,
  point: TimedPoint
): { alive: Attempt[]; finished: boolean } {
  const alive: Attempt[] = [];
  for (const attempt of running) {
    attempt.coveredM += haversineMeters(attempt.last, point);
    attempt.last = point;
    const room = segment.distanceM * SEGMENT_MAX_COVERAGE_RATIO - attempt.coveredM;
    if (room < 0) continue;
    const toEnd = haversineMeters(point, segment.end);
    if (toEnd > room) continue;
    const atEnd = toEnd <= SEGMENT_GATE_RADIUS_M;
    if (atEnd && attempt.coveredM >= segment.distanceM * SEGMENT_MIN_COVERAGE_RATIO) {
      return { alive: [], finished: true };
    }
    alive.push(attempt);
  }
  return { alive, finished: false };
}

function formatClock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/**
 * Follows a live track against a set of segments, one fix at a time. Mirrors the gates and
 * coverage limits of the server's matcher, so what shows on the screen is what would be scored.
 * Each fix costs one box test per idle segment; real distances are only taken near a start gate
 * or for a segment already under way.
 */
export function createLiveSegmentTracker(initial: readonly LiveSegment[] = []) {
  let segments = [...initial];
  const attempts = new Map<string, Attempt[]>();

  const nearStart = (point: TimedPoint, segment: LiveSegment) => {
    const box = (SEGMENT_GATE_RADIUS_M + 5) * DEG_PER_M;
    if (Math.abs(point.latitude - segment.start.latitude) > box) return false;
    const lngBox = box / Math.max(0.01, Math.cos((segment.start.latitude * Math.PI) / 180));
    return Math.abs(point.longitude - segment.start.longitude) <= lngBox;
  };

  return {
    setSegments(next: readonly LiveSegment[]) {
      segments = [...next];
      const keys = new Set(segments.map((s) => s.key));
      for (const key of attempts.keys()) if (!keys.has(key)) attempts.delete(key);
    },

    /** Feeds the next fix and returns the segment being ridden now, if any. */
    update(point: TimedPoint): LiveSegmentStatus | null {
      let best: LiveSegmentStatus | null = null;
      for (const segment of segments) {
        const { alive, finished } = advance(attempts.get(segment.key) ?? [], segment, point);
        if (finished) {
          attempts.delete(segment.key);
          continue;
        }
        if (
          nearStart(point, segment) &&
          haversineMeters(point, segment.start) <= SEGMENT_GATE_RADIUS_M
        ) {
          alive.push({ startedAt: point.timestamp, coveredM: 0, last: point });
          if (alive.length > MAX_ATTEMPTS) alive.shift();
        }
        if (alive.length === 0) {
          attempts.delete(segment.key);
          continue;
        }
        attempts.set(segment.key, alive);
        const newest = alive[alive.length - 1];
        if (!newest || newest.coveredM < SEGMENT_GATE_RADIUS_M) continue;
        const status: LiveSegmentStatus = {
          key: segment.key,
          name: segment.name,
          elapsedSec: Math.max(0, Math.round((point.timestamp - newest.startedAt) / 1000)),
          coveredM: Math.round(newest.coveredM),
          distanceM: segment.distanceM,
          prSec: segment.prSec,
          leaderSec: segment.leaderSec,
        };
        if (!best || status.coveredM / status.distanceM > best.coveredM / best.distanceM)
          best = status;
      }
      return best;
    },

    reset() {
      attempts.clear();
    },
  };
}
