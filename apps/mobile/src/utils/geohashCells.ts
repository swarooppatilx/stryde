import { encodeGeohash } from '@repo/shared/segments';

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

const DEFAULT_MAX_CELLS = 9;

/** Cells of a geohash grid: each character carries 5 bits, taken longitude first. */
function gridFor(precision: number) {
  const bits = precision * 5;
  const lngBits = Math.ceil(bits / 2);
  const latBits = bits - lngBits;
  return {
    lngCells: 2 ** lngBits,
    latCells: 2 ** latBits,
    lngWidth: 360 / 2 ** lngBits,
    latHeight: 180 / 2 ** latBits,
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * The geohash cells a map box covers, the one at the centre first. At most `maxCells` come back:
 * a map zoomed far out is cut to the middle of the view instead of asking for the world.
 */
export function geohashCellsForBounds(
  bounds: Bounds,
  precision: number,
  maxCells = DEFAULT_MAX_CELLS
): string[] {
  const { south, west, north, east } = bounds;
  if (![south, west, north, east].every(Number.isFinite)) return [];
  if (south > north || west > east || maxCells < 1) return [];

  const grid = gridFor(precision);
  const lat = (value: number) => clamp(value, -90, 90);
  const lng = (value: number) => clamp(value, -180, 180);
  const latIndex = (value: number) =>
    clamp(Math.floor((lat(value) + 90) / grid.latHeight), 0, grid.latCells - 1);
  const lngIndex = (value: number) =>
    clamp(Math.floor((lng(value) + 180) / grid.lngWidth), 0, grid.lngCells - 1);

  const centreLat = latIndex((south + north) / 2);
  const centreLng = lngIndex((west + east) / 2);
  // No more than this many cells either way from the middle can survive the cap.
  const reach = Math.ceil(Math.sqrt(maxCells));
  const latFrom = Math.max(latIndex(south), centreLat - reach);
  const latTo = Math.min(latIndex(north), centreLat + reach);
  const lngFrom = Math.max(lngIndex(west), centreLng - reach);
  const lngTo = Math.min(lngIndex(east), centreLng + reach);

  const found: Array<{ cell: string; distance: number }> = [];
  for (let i = latFrom; i <= latTo; i++) {
    for (let j = lngFrom; j <= lngTo; j++) {
      const cell = encodeGeohash(
        (i + 0.5) * grid.latHeight - 90,
        (j + 0.5) * grid.lngWidth - 180,
        precision
      );
      found.push({ cell, distance: (i - centreLat) ** 2 + (j - centreLng) ** 2 });
    }
  }
  return found
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxCells)
    .map((entry) => entry.cell);
}

/** The box a map shows, from its centre, zoom and size in points (web-mercator, 512-point tiles). */
export function boundsFromCamera(
  center: [number, number],
  zoom: number,
  width: number,
  height: number
): Bounds {
  const [lng, lat] = center;
  const degPerPoint = 360 / (512 * 2 ** zoom);
  const halfLng = (width / 2) * degPerPoint;
  const halfLat = (height / 2) * degPerPoint * Math.cos((lat * Math.PI) / 180);
  return {
    south: clamp(lat - halfLat, -90, 90),
    north: clamp(lat + halfLat, -90, 90),
    west: clamp(lng - halfLng, -180, 180),
    east: clamp(lng + halfLng, -180, 180),
  };
}
