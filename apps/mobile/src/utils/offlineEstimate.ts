/** Mapbox's own corner order: [north-east, south-west], each [longitude, latitude]. */
export type RegionBounds = [[number, number], [number, number]];

export interface ZoomPreset {
  id: 'overview' | 'streets' | 'detail';
  label: string;
  hint: string;
  min: number;
  max: number;
}

export const ZOOM_PRESETS: readonly ZoomPreset[] = [
  { id: 'overview', label: 'Overview', hint: 'Towns and main roads', min: 8, max: 12 },
  { id: 'streets', label: 'Streets', hint: 'Streets and paths', min: 10, max: 15 },
  { id: 'detail', label: 'Detailed', hint: 'Every path and building', min: 12, max: 16 },
];

/** More tiles than this is refused: it would take too long and too much room on the phone. */
export const MAX_REGION_TILES = 20_000;

/** Rough average download size of one tile; imagery is far heavier than the street map. */
const BYTES_PER_TILE = { map: 30_000, imagery: 80_000 } as const;

export const RADIUS_OPTIONS_KM = [2, 5, 10, 25] as const;

const MAX_MERCATOR_LAT = 85.0511;
const KM_PER_DEGREE = 111.32;

const clampLat = (lat: number) => Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));

function tileX(lng: number, zoom: number): number {
  const n = 2 ** zoom;
  return Math.min(n - 1, Math.max(0, Math.floor(((lng + 180) / 360) * n)));
}

function tileY(lat: number, zoom: number): number {
  const n = 2 ** zoom;
  const rad = (clampLat(lat) * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return Math.min(n - 1, Math.max(0, y));
}

/** How many map tiles cover the box at every zoom from `minZoom` to `maxZoom`. */
export function tileCount(bounds: RegionBounds, minZoom: number, maxZoom: number): number {
  const [[east, north], [west, south]] = bounds;
  let total = 0;
  for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
    const columns = tileX(east, zoom) - tileX(west, zoom) + 1;
    const rows = tileY(south, zoom) - tileY(north, zoom) + 1;
    total += Math.max(1, columns) * Math.max(1, rows);
  }
  return total;
}

/** A square around a point, `radiusKm` from the centre to each side. */
export function regionAround(center: readonly [number, number], radiusKm: number): RegionBounds {
  const [lng, lat] = center;
  const dLat = radiusKm / KM_PER_DEGREE;
  const dLng = radiusKm / (KM_PER_DEGREE * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return [
    [Math.min(180, lng + dLng), Math.min(MAX_MERCATOR_LAT, lat + dLat)],
    [Math.max(-180, lng - dLng), Math.max(-MAX_MERCATOR_LAT, lat - dLat)],
  ];
}

export interface RegionEstimate {
  tiles: number;
  /** An estimate, not a promise: real tiles vary a lot in size. */
  bytes: number;
  tooLarge: boolean;
}

export function estimateRegion(
  bounds: RegionBounds,
  minZoom: number,
  maxZoom: number,
  imagery: boolean
): RegionEstimate {
  const tiles = tileCount(bounds, minZoom, maxZoom);
  return {
    tiles,
    bytes: tiles * BYTES_PER_TILE[imagery ? 'imagery' : 'map'],
    tooLarge: tiles > MAX_REGION_TILES,
  };
}

/** The deepest zoom (from `minZoom` up to `maxZoom`) whose tiles still fit the cap; null when even `minZoom` is too much. */
export function deepestZoomWithinCap(
  bounds: RegionBounds,
  minZoom: number,
  maxZoom: number
): number | null {
  for (let zoom = maxZoom; zoom >= minZoom; zoom--) {
    if (tileCount(bounds, minZoom, zoom) <= MAX_REGION_TILES) return zoom;
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1_048_576) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1_073_741_824) {
    return `${(bytes / 1_048_576).toFixed(bytes < 10_485_760 ? 1 : 0)} MB`;
  }
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}
