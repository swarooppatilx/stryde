import type { ActivityType } from '@/types';
import type { RoutePoint } from '@/utils/route';

/** Mapbox Directions profiles: footpaths and trails, or roads and cycleways. */
export type DirectionsProfile = 'walking' | 'cycling';

/** Mapbox allows this many coordinates per request; longer routes go in overlapping pieces. */
export const MAX_DIRECTIONS_POINTS = 25;
const DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox';
const TIMEOUT_MS = 10_000;

export function profileFor(sport: ActivityType): DirectionsProfile {
  return sport === 'ride' ? 'cycling' : 'walking';
}

export function directionsUrl(
  points: readonly RoutePoint[],
  profile: DirectionsProfile,
  token: string
): string {
  const coords = points.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
  return `${DIRECTIONS_URL}/${profile}/${coords}?geometries=geojson&overview=full&steps=false&continue_straight=true&access_token=${encodeURIComponent(token)}`;
}

export interface SnappedLine {
  coordinates: RoutePoint[];
  /** Metres along the paths, as Mapbox measured it. */
  distance: number;
}

/** The best route of a Directions response, or null when Mapbox found none. */
export function parseDirections(json: unknown): SnappedLine | null {
  const route = (json as { code?: string; routes?: unknown[] })?.routes?.[0] as
    | { distance?: number; geometry?: { coordinates?: unknown } }
    | undefined;
  if ((json as { code?: string })?.code !== 'Ok' || !route) return null;
  const coords = route.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const coordinates = coords.filter(
    (c): c is RoutePoint => Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number'
  );
  return { coordinates, distance: typeof route.distance === 'number' ? route.distance : 0 };
}

/** Consecutive pieces of at most `size` points, each starting where the last ended. */
export function chunkWaypoints(
  points: readonly RoutePoint[],
  size = MAX_DIRECTIONS_POINTS
): RoutePoint[][] {
  if (points.length <= size) return [[...points]];
  const chunks: RoutePoint[][] = [];
  for (let start = 0; start < points.length - 1; start += size - 1) {
    chunks.push(points.slice(start, start + size));
  }
  return chunks;
}

export interface DirectionsOptions {
  token: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

/**
 * The path a runner or rider would take through the waypoints, following footpaths, trails or
 * roads. Null when any piece cannot be routed (no token, offline, or no path between two points).
 */
export async function fetchSnappedLine(
  points: readonly RoutePoint[],
  profile: DirectionsProfile,
  { token, fetchImpl = fetch, signal }: DirectionsOptions
): Promise<SnappedLine | null> {
  if (!token || points.length < 2) return null;
  const pieces: SnappedLine[] = [];
  for (const chunk of chunkWaypoints(points)) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort);
    const timer = setTimeout(abort, TIMEOUT_MS);
    try {
      const response = await fetchImpl(directionsUrl(chunk, profile, token), {
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const piece = parseDirections(await response.json());
      if (!piece) return null;
      pieces.push(piece);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  return {
    // Each piece starts where the last ended: drop the repeated joint.
    coordinates: pieces.flatMap((p, i) => (i === 0 ? p.coordinates : p.coordinates.slice(1))),
    distance: pieces.reduce((sum, p) => sum + p.distance, 0),
  };
}
