import { Hono } from 'hono';
import { logError } from '../lib/logError.js';
import { createTtlCache } from '../lib/ttlCache.js';

type Profile = 'foot' | 'bike';
type LngLat = [number, number];

export interface RoutingResult {
  coordinates: LngLat[];
  /** Metres along the network. */
  distance: number;
  /** Seconds the router estimates. */
  duration: number;
}

const MAX_POINTS = 25;
const UPSTREAM_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 300;
// The OSRM demo at router.project-osrm.org only serves driving. FOSSGIS runs separate foot and bike
// instances, each mounted under its own path (the profile segment in the URL stays "driving" for all).
const DEFAULT_BASE_URL = 'https://routing.openstreetmap.de';

function isLngLat(value: unknown): value is LngLat {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}

function isRoutingResult(value: unknown): value is RoutingResult {
  return (
    !!value && typeof value === 'object' && Array.isArray((value as RoutingResult).coordinates)
  );
}

interface Options {
  fetch?: typeof fetch;
  baseUrl?: string;
}

/**
 * Snap-to-road for the route builder. The phone sends waypoints, this proxies a public OSRM
 * instance, so the provider can change (or be self-hosted) without shipping a new app, and repeated
 * legs are answered from a short cache instead of hitting a free service twice.
 */
export function createRoutingRoutes({ fetch: doFetch = fetch, baseUrl }: Options = {}) {
  const routing = new Hono();
  const cache = createTtlCache<RoutingResult>(CACHE_TTL_MS, CACHE_MAX);

  routing.post('/route', async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      profile?: unknown;
      points?: unknown;
    } | null;
    const profile = body?.profile;
    const points = body?.points;
    if (profile !== 'foot' && profile !== 'bike') return c.json({ error: 'invalid_profile' }, 400);
    if (
      !Array.isArray(points) ||
      points.length < 2 ||
      points.length > MAX_POINTS ||
      !points.every(isLngLat)
    ) {
      return c.json({ error: 'invalid_points' }, 400);
    }

    const coords = (points as LngLat[]).map(([lng, lat]) => `${lng},${lat}`).join(';');
    const key = `${profile as Profile}:${coords}`;
    const hit = cache.get(key);
    if (hit) return c.json(hit);

    const root = baseUrl ?? process.env.ROUTING_BASE_URL ?? DEFAULT_BASE_URL;
    const url = `${root}/routed-${profile}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    try {
      const res = await doFetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
      const data = (await res.json().catch(() => ({}))) as {
        code?: string;
        routes?: { distance: number; duration: number; geometry: { coordinates: LngLat[] } }[];
      };
      // OSRM answers an unroutable pair with HTTP 400 and code NoRoute/NoSegment: the points are the
      // problem, not the service. Any other failure status is an outage.
      if (data.code === 'NoRoute' || data.code === 'NoSegment')
        return c.json({ error: 'no_route' }, 422);
      const best = data.routes?.[0];
      if (!res.ok || data.code !== 'Ok' || !best)
        return c.json({ error: 'routing_unavailable' }, 502);
      const value: RoutingResult = {
        coordinates: best.geometry.coordinates,
        distance: best.distance,
        duration: best.duration,
      };
      if (!isRoutingResult(value)) return c.json({ error: 'routing_unavailable' }, 502);
      cache.set(key, value);
      return c.json(value);
    } catch (error) {
      logError('routing upstream failed', error);
      return c.json({ error: 'routing_unavailable' }, 502);
    }
  });

  return routing;
}

export const routing = createRoutingRoutes();
