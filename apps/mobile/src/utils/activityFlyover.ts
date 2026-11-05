import { haversineDistance } from '@/utils/geo';
import type { RoutePoint } from '@/utils/route';

export interface FlyoverFrame {
  /** Where the camera looks at this moment. */
  center: RoutePoint;
  /** The way the camera faces: along the route, a little ahead. */
  bearing: number;
  /** The last route point already passed, for drawing the line so far. */
  index: number;
}

const RAD = Math.PI / 180;

function bearingBetween(a: RoutePoint, b: RoutePoint): number {
  const phi1 = a[1] * RAD;
  const phi2 = b[1] * RAD;
  const dLambda = (b[0] - a[0]) * RAD;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Shortest signed turn from one bearing to another, in degrees (-180, 180]. */
function turn(from: number, to: number): number {
  const d = ((((to - from) % 360) + 540) % 360) - 180;
  return d === -180 ? 180 : d;
}

/** Point and segment index at `distance` metres along the line. */
function along(line: readonly RoutePoint[], cumulative: readonly number[], distance: number) {
  let i = 1;
  while (i < line.length - 1 && (cumulative[i] as number) < distance) i++;
  const a = line[i - 1] as RoutePoint;
  const b = line[i] as RoutePoint;
  const span = (cumulative[i] as number) - (cumulative[i - 1] as number);
  const t =
    span > 0 ? Math.min(1, Math.max(0, (distance - (cumulative[i - 1] as number)) / span)) : 0;
  const point: RoutePoint = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { point, index: t >= 1 ? i : i - 1 };
}

/**
 * Camera frames evenly spaced along the route. Each faces a point a little way ahead, and the
 * turns are smoothed so a zig-zag of GPS points does not spin the view.
 */
export function flyoverFrames(
  line: readonly RoutePoint[],
  frameCount = 120,
  lookAheadShare = 0.03,
  smoothing = 0.25
): FlyoverFrame[] {
  if (line.length < 2) return [];
  const cumulative = [0];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as RoutePoint;
    const b = line[i] as RoutePoint;
    cumulative.push((cumulative[i - 1] as number) + haversineDistance(a[1], a[0], b[1], b[0]));
  }
  const total = cumulative.at(-1) as number;
  if (total <= 0) return [];
  const lookAhead = Math.max(total * lookAheadShare, 30);

  const frames: FlyoverFrame[] = [];
  let bearing: number | null = null;
  for (let k = 0; k < frameCount; k++) {
    const d = (k / (frameCount - 1)) * total;
    const here = along(line, cumulative, d);
    const ahead = along(line, cumulative, Math.min(total, d + lookAhead));
    const stationary = ahead.point[0] === here.point[0] && ahead.point[1] === here.point[1];
    const target: number = stationary ? (bearing ?? 0) : bearingBetween(here.point, ahead.point);
    const next: number =
      bearing === null ? target : (bearing + turn(bearing, target) * smoothing + 360) % 360;
    bearing = next;
    frames.push({ center: here.point, bearing: next, index: here.index });
  }
  return frames;
}

/** Route length in metres. */
export function lineLength(line: readonly RoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as RoutePoint;
    const b = line[i] as RoutePoint;
    total += haversineDistance(a[1], a[0], b[1], b[0]);
  }
  return total;
}

/** Closer in for a short route, further out for a long one, so the ground ahead stays in view. */
export function flyoverZoom(totalM: number): number {
  if (totalM < 3000) return 15.6;
  if (totalM < 15_000) return 14.8;
  if (totalM < 60_000) return 13.8;
  return 12.8;
}

/** Playback length: longer routes take longer, within limits, then divided by the speed. */
export function flyoverDurationMs(totalM: number, speed: number): number {
  const base = Math.min(45_000, Math.max(15_000, (totalM / 1000) * 3000));
  return base / Math.max(speed, 0.25);
}
