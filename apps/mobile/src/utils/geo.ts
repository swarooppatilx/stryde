import type { Location } from '@/types';

const EARTH_RADIUS_M = 6371e3;
const toRad = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance between two coordinates, in meters. */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return 0;
  }
  const R = EARTH_RADIUS_M;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/** A heading wrapped into [0, 360). */
export function normalizeBearing(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** The signed shortest turn from one bearing to another, in (-180, 180]. */

/** The signed shortest turn from one bearing to another, in (-180, 180]. */
export function angleDelta(from: number, to: number): number {
  const delta = normalizeBearing(to - from);
  return delta > 180 ? delta - 360 : delta;
}

/** The compass heading from one [lng, lat] point to another, in [0, 360). */
export function bearingBetween(from: [number, number], to: [number, number]): number {
  const lat1 = toRad(from[1]);
  const lat2 = toRad(to[1]);
  const dLng = toRad(to[0] - from[0]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return normalizeBearing((Math.atan2(y, x) * 180) / Math.PI);
}

/**
 * Where a short walk of `distanceM` metres on `headingRadians` (0 is north, a quarter turn is east)
 * from a point ends up. A flat approximation, fine for the few metres between two steps.
 */
export function destinationPoint(
  latitude: number,
  longitude: number,
  distanceM: number,
  headingRadians: number
): { latitude: number; longitude: number } {
  const dLat = (distanceM * Math.cos(headingRadians)) / EARTH_RADIUS_M;
  const dLng =
    (distanceM * Math.sin(headingRadians)) / (EARTH_RADIUS_M * Math.cos(toRad(latitude)));
  return {
    latitude: latitude + (dLat * 180) / Math.PI,
    longitude: longitude + (dLng * 180) / Math.PI,
  };
}

/** Speed in m/s between two timed locations. Returns 0 if timestamps are equal. */
function speedBetween(a: Location, b: Location): number {
  const dt = (b.timestamp - a.timestamp) / 1000;
  if (dt <= 0) return 0;
  return haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude) / dt;
}

/** Matches the default activity (a run): faster activities pass their own limit. */
const DEFAULT_MAX_SPEED_MS = 25 / 3.6;

/** After this many fixes in a row are rejected, the next one becomes the new reference. */
const MAX_CONSECUTIVE_REJECTS = 3;

export interface OutlierOptions {
  /** Fastest plausible speed for the activity, in m/s. */
  maxSpeedMs?: number;
  /** Fixes reporting worse accuracy than this (m) are dropped. */
  maxAccuracyM?: number;
}

/** Drops fixes with accuracy worse than `maxAccuracyM` (default 30 m) or implying a speed above `maxSpeedMs` from the last kept fix. Comparing to the previous raw fix would discard the good fix after each glitch. Repeated rejections mean the track genuinely moved on, so the next fix becomes the new reference. */
export function rejectOutliers(
  locations: Location[],
  { maxSpeedMs = DEFAULT_MAX_SPEED_MS, maxAccuracyM = 30 }: OutlierOptions = {}
): Location[] {
  const filter = new OutlierFilter(maxSpeedMs, maxAccuracyM);
  return locations.filter((loc) => filter.accept(loc));
}

/**
 * The outlier rule as a filter that remembers its state, so a track can be cleaned one fix at a
 * time (what `rejectOutliers` does over a whole array, and what a live recording needs).
 */
export class OutlierFilter {
  private anchor: Location | undefined;
  private consecutiveRejects = 0;

  constructor(
    private readonly maxSpeedMs: number = DEFAULT_MAX_SPEED_MS,
    private readonly maxAccuracyM: number = 30
  ) {}

  /** Whether to keep this fix; a kept fix becomes the baseline for the next one. */
  accept(loc: Location): boolean {
    if (loc.accuracy > this.maxAccuracyM) return false;

    const implausible =
      this.anchor !== undefined && speedBetween(this.anchor, loc) > this.maxSpeedMs;
    if (implausible && this.consecutiveRejects < MAX_CONSECUTIVE_REJECTS) {
      this.consecutiveRejects++;
      return false;
    }

    this.consecutiveRejects = 0;
    this.anchor = loc;
    return true;
  }
}

/** Points either side of a point that its smoothed position draws on. */
export const SMOOTHING_HALF_WINDOW = 2;

/** The smoothed version of `locations[i]`: points in the window around it weighted by `1 / accuracy` (m). */
export function smoothAt(locations: readonly Location[], i: number): Location {
  const location = locations[i] as Location;
  let weightSum = 0;
  let lngSum = 0;
  let latSum = 0;

  const from = Math.max(0, i - SMOOTHING_HALF_WINDOW);
  const to = Math.min(locations.length, i + SMOOTHING_HALF_WINDOW + 1);
  for (let n = from; n < to; n++) {
    const neighbour = locations[n] as Location;
    const w = neighbour.accuracy > 0 ? 1 / neighbour.accuracy : 1;
    weightSum += w;
    lngSum += neighbour.longitude * w;
    latSum += neighbour.latitude * w;
  }

  return {
    latitude: latSum / weightSum,
    longitude: lngSum / weightSum,
    timestamp: location.timestamp,
    accuracy: location.accuracy,
  };
}

export function smoothLocations(locations: Location[]): Location[] {
  if (locations.length < 3) return locations;
  return locations.map((_, i) => smoothAt(locations, i));
}
