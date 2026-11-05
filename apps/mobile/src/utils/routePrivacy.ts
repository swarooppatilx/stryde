import type { PrivacyZone } from '@/types';
import { haversineDistance } from './geo';

type LngLat = [number, number];

/** How much of each end of a route is kept private when the athlete opts in. */
const PRIVATE_ROUTE_END_METERS = 200;

/** The most a cut may grow past its configured distance, as a share of it. */
const MAX_JITTER_SHARE = 0.4;

/** A number in [0, 1) that only depends on the text (FNV-1a), so the same seed always lands the same. */
function unitFromSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 0x01000193);
  }
  return (hash >>> 0) / 0x100000000;
}

/**
 * The distance actually cut: the configured one plus a seeded extra of up to 40%. Clipped endpoints
 * from many activities would otherwise all sit on one circle whose centre is the private place.
 * It never goes below the configured distance, so the privacy asked for is a floor.
 */
export function jitteredRadius(meters: number, seed: string): number {
  if (meters <= 0) return meters;
  return meters + Math.round(meters * MAX_JITTER_SHARE * unitFromSeed(seed));
}

/**
 * Drops the start until it is at least `meters` along the path AND `meters` away in a straight line
 * from where the route began. Walking in circles near the door adds path but not distance, so the
 * path length alone could leave the first kept point right next to it.
 */
function cutFromStart(route: readonly LngLat[], meters: number): LngLat[] {
  const origin = route[0];
  if (!origin) return [];
  let walked = 0;
  for (let i = 1; i < route.length; i++) {
    const [lng1, lat1] = route[i - 1] as LngLat;
    const [lng2, lat2] = route[i] as LngLat;
    walked += haversineDistance(lat1, lng1, lat2, lng2);
    if (walked >= meters && haversineDistance(origin[1], origin[0], lat2, lng2) >= meters) {
      return route.slice(i);
    }
  }
  return [];
}

/**
 * The route without at least its first and last `meters` (a seeded extra varies it), so a shared run doesn't point at the
 * athlete's front door. A route too short to keep anything private shares nothing.
 */
export function trimRouteEnds(route: readonly LngLat[], meters: number, seed: string): LngLat[] {
  // Not `meters <= 0`: that lets NaN through, and a NaN cut would swallow the whole route.
  if (!(meters > 0)) return [...route];
  const fromStart = cutFromStart(route, jitteredRadius(meters, `${seed}:start`));
  return cutFromStart([...fromStart].reverse(), jitteredRadius(meters, `${seed}:end`)).reverse();
}

const inAnyZone = (
  point: LngLat,
  zones: readonly { latitude: number; longitude: number; radius: number }[]
) => zones.some((z) => haversineDistance(point[1], point[0], z.latitude, z.longitude) <= z.radius);

/**
 * The route without the stretch at its start and at its end that lies inside a privacy zone. A pass
 * through a zone in the middle stays: only where the athlete begins and ends gives a place away.
 * A route that never leaves a zone shares nothing. Each zone reaches a little past its radius by a
 * seeded amount (see `jitteredRadius`), the same for the same seed.
 */
export function trimToZones(
  route: readonly LngLat[],
  allZones: readonly PrivacyZone[],
  seed: string
): LngLat[] {
  if (allZones.length === 0 || route.length === 0) return [...route];
  const zones = allZones.map((z) => ({
    ...z,
    radius: jitteredRadius(z.radius, `${seed}:${z.id}`),
  }));
  let start = 0;
  while (start < route.length && inAnyZone(route[start] as LngLat, zones)) start++;
  let end = route.length;
  while (end > start && inAnyZone(route[end - 1] as LngLat, zones)) end--;
  return route.slice(start, end);
}

/**
 * The route others may see: privacy zones cut first, then the fixed start/end trim when the athlete
 * chose it. The seed (the activity id) keeps a later edit cutting exactly where the first post did.
 * `cutByZone` says a zone removed something, so the loop shape is not published either.
 */
export function publicRoute(
  route: readonly LngLat[],
  options: { hideEnds: boolean; zones: readonly PrivacyZone[]; seed: string }
): { route: LngLat[]; cutByZone: boolean } {
  const afterZones = trimToZones(route, options.zones, options.seed);
  return {
    route: trimRouteEnds(afterZones, options.hideEnds ? PRIVATE_ROUTE_END_METERS : 0, options.seed),
    cutByZone: afterZones.length < route.length,
  };
}

/**
 * Whether the territory outline may leave the device. The loop runs through the route's real
 * start and end, so it stays private whenever the route is hidden, its ends are hidden, or a zone cut it.
 */
export function canShareTerritory(
  activity: { hideRoute?: boolean; hideRouteEnds?: boolean },
  cutByZone: boolean
): boolean {
  return !activity.hideRoute && !activity.hideRouteEnds && !cutByZone;
}
