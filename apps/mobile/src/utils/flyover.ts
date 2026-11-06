import { pointsAtFractions } from '@/utils/colorSegments';
import { angleDelta, bearingBetween, haversineDistance, normalizeBearing } from '@/utils/geo';

type Point = [number, number];

export interface FlyoverFrame {
  /** 0 at the start of the route, 1 at the end. */
  progress: number;
  /** Metres along the route. */
  distance: number;
  center: Point;
  /** Compass heading the camera faces, in [0, 360). */
  bearing: number;
}

function routeLength(line: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as Point;
    const b = line[i] as Point;
    total += haversineDistance(a[1], a[0], b[1], b[0]);
  }
  return total;
}

/** How far ahead the camera looks to pick its heading: a share of the route, never under about 60 m. */
const LOOK_AHEAD_SHARE = 0.04;
const MIN_LOOK_AHEAD_M = 60;
/** How much of the gap to the wanted heading is closed each frame; lower turns more lazily. */
const TURN_RATE = 0.35;

/**
 * `count` camera positions evenly spaced along the route, each facing where the route is heading a
 * little further on, with the heading eased from frame to frame so corners are taken as a turn
 * and not a snap. Empty for a route with no length.
 */
export function flyoverFrames(line: readonly Point[], count: number): FlyoverFrame[] {
  if (line.length < 2 || count < 2) return [];
  const total = routeLength(line);
  if (total <= 0) return [];

  const fractions = Array.from({ length: count }, (_, i) => i / (count - 1));
  const lookAhead = Math.max(LOOK_AHEAD_SHARE, MIN_LOOK_AHEAD_M / total);
  const centers = pointsAtFractions(line, fractions);
  const ahead = pointsAtFractions(
    line,
    fractions.map((f) => Math.min(1, f + lookAhead))
  );
  const behind = pointsAtFractions(
    line,
    fractions.map((f) => Math.max(0, f - lookAhead))
  );

  const frames: FlyoverFrame[] = [];
  let heading = 0;
  for (let i = 0; i < count; i++) {
    const center = centers[i] as Point;
    const next = ahead[i] as Point;
    const prev = behind[i] as Point;
    // At the very end there is nothing ahead, so face the way the last stretch was going.
    const wanted =
      next[0] === center[0] && next[1] === center[1]
        ? bearingBetween(prev, center)
        : bearingBetween(center, next);
    heading =
      i === 0 ? wanted : normalizeBearing(heading + angleDelta(heading, wanted) * TURN_RATE);
    frames.push({
      progress: fractions[i] as number,
      distance: (fractions[i] as number) * total,
      center,
      bearing: heading,
    });
  }
  return frames;
}

/** The camera at `progress` (0 to 1), blended between the two frames around it; clamps at both ends. */
export function frameAt(frames: readonly FlyoverFrame[], progress: number): FlyoverFrame | null {
  const first = frames[0];
  const last = frames.at(-1);
  if (!first || !last) return null;
  if (progress <= first.progress) return first;
  if (progress >= last.progress) return last;
  let i = 0;
  while (i < frames.length - 2 && (frames[i + 1] as FlyoverFrame).progress < progress) i++;
  const a = frames[i] as FlyoverFrame;
  const b = frames[i + 1] as FlyoverFrame;
  const t = (progress - a.progress) / (b.progress - a.progress);
  return {
    progress,
    distance: a.distance + (b.distance - a.distance) * t,
    center: [
      a.center[0] + (b.center[0] - a.center[0]) * t,
      a.center[1] + (b.center[1] - a.center[1]) * t,
    ],
    bearing: normalizeBearing(a.bearing + angleDelta(a.bearing, b.bearing) * t),
  };
}

const MIN_DURATION_MS = 12_000;
const MAX_DURATION_MS = 60_000;

/** How long the flight takes: longer routes take longer, within a watchable range, then sped up by the multiplier. */
export function flyoverDurationMs(totalMeters: number, speed: number): number {
  const base = 8_000 + 6_000 * (totalMeters / 1000);
  return Math.min(Math.max(base, MIN_DURATION_MS), MAX_DURATION_MS) / speed;
}

export const FLYOVER_SPEEDS = [1, 2, 4] as const;

/** The next playback speed when the speed chip is tapped: 1x, 2x, 4x, then round again. */
export function nextFlyoverSpeed(speed: number): number {
  const i = FLYOVER_SPEEDS.indexOf(speed as (typeof FLYOVER_SPEEDS)[number]);
  return FLYOVER_SPEEDS[(i + 1) % FLYOVER_SPEEDS.length] as number;
}

/** Where the flight is after `elapsedMs` more of it, from `start`; never past the end. */
export function flyoverProgress(start: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return start;
  return Math.min(1, start + elapsedMs / durationMs);
}
