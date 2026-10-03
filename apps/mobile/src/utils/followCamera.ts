import { haversineDistance } from './geo';
import type { FollowMode } from './recordCamera';

type LngLat = [number, number];

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CameraTarget {
  center: LngLat;
  zoom: number;
  bearing: number;
  pitch: number;
  padding: Padding;
}

export interface ViewSnapshot {
  center: LngLat;
  zoom: number;
  bearing: number;
}

export const MIN_ZOOM = 12;
export const MAX_ZOOM = 19;
export const ZOOM_STEP = 1;
/** The camera's tilt in 3D view. */
export const TILT_DEGREES = 60;

/** Below this ground speed the phone's course is noise; the last heading is kept instead. */
const COURSE_MIN_SPEED = 1;
const HEADING_SMOOTHING = 0.35;
/** The camera ignores a fix that moved the puck less than this, or turned it less than the heading step. */
const MIN_EASE_DISPLACEMENT_M = 1.5;
const MIN_EASE_HEADING_DEG = 8;
/** Heading-up puts the puck this far down the map (0 is the top); top padding of 2p - 1 of the height puts the padded centre there. */
const LOOK_AHEAD_POSITION = 2 / 3;
/** Metres per pixel of a 512 px tile at zoom 0 on the equator. */
const METERS_PER_PIXEL_Z0 = 78271.517;
const PAN_MIN_PX = 12;
const ROTATE_MIN_DEG = 6;
const ZOOM_MIN_CHANGE = 0.02;

export const EASE_MS = 900;
export const ZOOM_EASE_MS = 250;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** One zoom level in (+1) or out (-1), kept inside the clamp. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  return clampZoom(zoom + direction * ZOOM_STEP);
}

export function normalizeBearing(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** The signed shortest turn from one bearing to another, in (-180, 180]. */
export function angleDelta(from: number, to: number): number {
  const delta = normalizeBearing(to - from);
  return delta > 180 ? delta - 360 : delta;
}

/**
 * The heading to show after a fix: the GPS course while moving, blended in along the shortest arc
 * so it does not whip round on noise. Standing still (or no course) keeps the last heading.
 */
export function smoothHeading(
  previous: number | null,
  fix: { bearing?: number; speed?: number }
): number | null {
  const { bearing, speed } = fix;
  if (bearing === undefined || !Number.isFinite(bearing)) return previous;
  if (speed === undefined || speed < COURSE_MIN_SPEED) return previous;
  if (previous === null) return normalizeBearing(bearing);
  return normalizeBearing(previous + HEADING_SMOOTHING * angleDelta(previous, bearing));
}

const sameValue = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** Whether the camera has anything worth animating to, so it does not move on every fix. */
export function shouldEase(previous: CameraTarget | null, next: CameraTarget): boolean {
  if (!previous) return true;
  if (!sameValue(previous.zoom, next.zoom)) return true;
  if (previous.pitch !== next.pitch) return true;
  if (previous.padding.top !== next.padding.top || previous.padding.bottom !== next.padding.bottom)
    return true;
  if (Math.abs(angleDelta(previous.bearing, next.bearing)) >= MIN_EASE_HEADING_DEG) return true;
  const moved = haversineDistance(
    previous.center[1],
    previous.center[0],
    next.center[1],
    next.center[0]
  );
  return moved >= MIN_EASE_DISPLACEMENT_M;
}

const NO_PADDING: Padding = { top: 0, right: 0, bottom: 0, left: 0 };

export interface TargetInput {
  position: LngLat;
  mode: FollowMode;
  zoom: number;
  /** Smoothed heading, or null before the first one. */
  heading: number | null;
  /** The map's current bearing, held in heading-up until a heading is known. */
  currentBearing: number;
  mapHeight: number;
  /** Height of the controls covering the bottom of the map; the puck stays in the part left clear. */
  bottomInset?: number;
  /** 3D view: the camera leans back. */
  tilted?: boolean;
}

/** Where the camera should be to follow the puck: north-up centred, heading-up turned with the puck low. */
export function buildTarget(input: TargetInput): CameraTarget {
  const zoom = clampZoom(input.zoom);
  const bottom = Math.max(0, Math.round(input.bottomInset ?? 0));
  const pitch = input.tilted ? TILT_DEGREES : 0;
  if (input.mode === 'north') {
    return {
      center: input.position,
      zoom,
      bearing: 0,
      pitch,
      padding: { ...NO_PADDING, bottom },
    };
  }
  const visible = Math.max(0, input.mapHeight - bottom);
  return {
    center: input.position,
    zoom,
    bearing: input.heading ?? input.currentBearing,
    pitch,
    padding: { ...NO_PADDING, bottom, top: Math.round(visible * (2 * LOOK_AHEAD_POSITION - 1)) },
  };
}

export type ViewChange = 'pan' | 'rotate' | 'zoom' | 'none';

/**
 * What a finger did to the map. Rotating and panning take the map away from the athlete; pinching
 * only changes the zoom, so following carries on at the new level.
 */
export function classifyViewChange(before: ViewSnapshot, after: ViewSnapshot): ViewChange {
  if (Math.abs(angleDelta(before.bearing, after.bearing)) >= ROTATE_MIN_DEG) return 'rotate';
  if (Math.abs(after.zoom - before.zoom) >= ZOOM_MIN_CHANGE) return 'zoom';
  const metres = haversineDistance(
    before.center[1],
    before.center[0],
    after.center[1],
    after.center[0]
  );
  const metresPerPixel =
    (METERS_PER_PIXEL_Z0 * Math.cos((after.center[1] * Math.PI) / 180)) / 2 ** after.zoom;
  return metres / metresPerPixel >= PAN_MIN_PX ? 'pan' : 'none';
}
