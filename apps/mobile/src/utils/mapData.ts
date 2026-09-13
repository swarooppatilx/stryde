import type { ActivityType } from '@/types';

export type LngLatPair = [number, number];
export type Ring = LngLatPair[];

/** Per-sport route colors for the map's "everyone's activities" layer, so a
 * glance at the map separates runs from rides from hikes even at a glance. */
export const SPORT_ROUTE_COLORS: Record<ActivityType, string> = {
  run: '#22c55e',
  ride: '#3b82f6',
  walk: '#a3e635',
  hike: '#f59e0b',
  swim: '#06b6d4',
  yoga: '#a855f7',
  workout: '#ef4444',
  hiit: '#f97316',
  dance: '#ec4899',
  climb: '#94a3b8',
  skate: '#14b8a6',
  row: '#0ea5e9',
};

export interface MapRouteInput {
  id: string;
  coordinates: LngLatPair[];
  color: string;
  lineWidth?: number;
}

export interface TerritoryFeatureInput {
  id: string;
  ring: Ring;
}

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

interface Feature {
  type: 'Feature';
  geometry:
    | { type: 'LineString'; coordinates: LngLatPair[] }
    | { type: 'Polygon'; coordinates: Ring[] }
    | { type: 'Point'; coordinates: LngLatPair };
  properties: Record<string, unknown>;
}

/** Downsample a dense GPS trace to at most `maxPoints` evenly-spaced points —
 * enough to keep the route's shape at map zoom but light enough to render a
 * dozen routes without a gl into the frame-budget. */
export function sampleRoute(coordinates: LngLatPair[], maxPoints = 400): LngLatPair[] {
  if (coordinates.length <= maxPoints) return coordinates;
  const step = coordinates.length / maxPoints;
  const sampled: LngLatPair[] = [];
  for (let i = 0; i < coordinates.length; i += step) {
    sampled.push(coordinates[Math.min(Math.floor(i), coordinates.length - 1)]);
  }
  if ((sampled[sampled.length - 1]?.[0] ?? 0) !== coordinates[coordinates.length - 1][0]) {
    sampled.push(coordinates[coordinates.length - 1]);
  }
  return sampled;
}

/** Aggregate route points into a light `[lng, lat]` point cloud for the
 * heatmap layer: evenly downsample each route, quantize to a fixed grid so
 * overlapping tracks collapse to a single hotter point, and cap the total. */
export function heatmapPoints(
  routes: MapRouteInput[],
  maxPerRoute = 60,
  gridDivisor = 4000,
  maxTotal = 1200
): LngLatPair[] {
  const seen = new Set<string>();
  const points: LngLatPair[] = [];

  const onGrid = (v: number) => Math.round(v * gridDivisor) / gridDivisor;
  const key = (lng: number, lat: number) => `${onGrid(lng)},${onGrid(lat)}`;

  for (const route of routes) {
    const step = Math.max(1, Math.floor(route.coordinates.length / maxPerRoute));
    for (let i = 0; i < route.coordinates.length && points.length < maxTotal; i += step) {
      const [lng, lat] = route.coordinates[i];
      if (points.length >= maxTotal) break;
      const k = key(lng, lat);
      if (seen.has(k)) continue;
      seen.add(k);
      points.push([lng, lat]);
    }
    if (points.length >= maxTotal) break;
  }

  return points;
}

export function routeFeatureCollection(routes: MapRouteInput[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: routes
      .filter((r) => r.coordinates.length >= 2)
      .map((r) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: r.coordinates },
        properties: { id: r.id, color: r.color },
      })),
  };
}

/** One polygon feature per territory, tagged with `territoryId` so a source
 * `onPress` can resolve which territory was tapped. */
export function territoryFeatureCollection(
  territories: TerritoryFeatureInput[]
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: territories.map((t) => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [t.ring] },
      properties: { territoryId: t.id },
    })),
  };
}

/** The bounding-box corner ring for a territory we only have bounds for
 * (subgraph-sourced, no full polygon) — a rounded-rectangle approximation of
 * the territory's footprint. */
export function territoryBoundsRing(b: {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}): Ring {
  const { minLng, minLat, maxLng, maxLat } = b;
  const inset = Math.min((maxLng - minLng) * 0.12, (maxLat - minLat) * 0.12, 0.0015);
  const lng1 = minLng + inset;
  const lat1 = minLat + inset;
  const lng2 = maxLng - inset;
  const lat2 = maxLat - inset;
  return [
    [lng1, lat1],
    [lng2, lat1],
    [lng2, lat2],
    [lng1, lat2],
    [lng1, lat1],
  ];
}

export function pointFeature(lngLat: LngLatPair): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: lngLat },
        properties: {},
      },
    ],
  };
}
