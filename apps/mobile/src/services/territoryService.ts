import type { Location, Ring } from '@/types';
import { pairs } from '@/utils/pairs';
import { findLargestLoop } from '@/utils/territoryLoops';

const METERS_PER_DEGREE_LAT = 111_320;

class TerritoryService {
  private static instance: TerritoryService;

  private constructor() {}

  static getInstance(): TerritoryService {
    if (!TerritoryService.instance) {
      TerritoryService.instance = new TerritoryService();
    }
    return TerritoryService.instance;
  }

  /** Whether the track closed a region worth claiming. */
  isClosedLoop(locations: Location[]): boolean {
    return findLargestLoop(locations) !== null;
  }

  /** The largest region the track closed (see `findLargestLoop`), or null. */
  getEnclosedPolygon(locations: Location[]): Ring | null {
    return findLargestLoop(locations)?.ring ?? null;
  }

  getPolygonArea(ring: Ring): number {
    const origin = ring[0];
    if (ring.length < 4 || !origin) return 0;

    const originLat = origin[1];
    const metersPerDegLng = METERS_PER_DEGREE_LAT * Math.cos((originLat * Math.PI) / 180);

    let sum = 0;
    for (const [[lng1, lat1], [lng2, lat2]] of pairs(ring)) {
      const x1 = lng1 * metersPerDegLng;
      const y1 = lat1 * METERS_PER_DEGREE_LAT;
      const x2 = lng2 * metersPerDegLng;
      const y2 = lat2 * METERS_PER_DEGREE_LAT;
      sum += x1 * y2 - x2 * y1;
    }
    return Math.abs(sum) / 2;
  }
}

export const territoryService = TerritoryService.getInstance();
