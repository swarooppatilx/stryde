import type { Segment } from '@/services/arkivService';
import { type Bounds, geohashCellsForBounds } from '@/utils/geohashCells';

/** The API's nearby query matches on this many geohash characters. */
export const NEARBY_PRECISION = 4;
/** A map view never asks for more cells than this, so panning around cannot flood the API. */
export const MAX_EXPLORE_CELLS = 6;

export type FetchCell = (latitude: number, longitude: number) => Promise<{ segments: Segment[] }>;

/**
 * Segments in a map view: the existing nearby query run once per covering cell, then merged by key.
 * A cell that fails is skipped so one slow answer does not blank the rest.
 */
export async function exploreSegments(bounds: Bounds, fetchCell: FetchCell): Promise<Segment[]> {
  const cells = geohashCellsForBounds(bounds, NEARBY_PRECISION, MAX_EXPLORE_CELLS);
  const results = await Promise.allSettled(
    cells.map((cell) => {
      const point = cellCentre(cell);
      return fetchCell(point.latitude, point.longitude);
    })
  );
  const byKey = new Map<string, Segment>();
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const segment of result.value.segments) byKey.set(segment.key, segment);
  }
  return [...byKey.values()];
}

const ALPHABET = '0123456789bcdefghjkmnpqrstuvwxyz';

/** The middle of a geohash cell. */
export function cellCentre(cell: string): { latitude: number; longitude: number } {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let evenBit = true;
  for (const char of cell) {
    const value = ALPHABET.indexOf(char);
    for (let bit = 4; bit >= 0; bit--) {
      const on = ((value >> bit) & 1) === 1;
      if (evenBit) {
        const mid = (lngMin + lngMax) / 2;
        if (on) lngMin = mid;
        else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (on) latMin = mid;
        else latMax = mid;
      }
      evenBit = !evenBit;
    }
  }
  return { latitude: (latMin + latMax) / 2, longitude: (lngMin + lngMax) / 2 };
}
