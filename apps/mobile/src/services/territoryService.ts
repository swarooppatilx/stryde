import type { Location, Ring } from '../types';
import { haversineDistance } from '../utils/geo';

/** Start and end must be within this distance to count as a closed loop. */
const LOOP_CLOSE_DISTANCE_METERS = 50;
/** Below this many points a "loop" is too degenerate to be meaningful. */
const MIN_LOOP_POINTS = 4;
/** Below this total path length, start≈end is just someone standing still. */
const MIN_LOOP_DISTANCE_METERS = 100;

const METERS_PER_DEGREE_LAT = 111_320;

export class TerritoryService {
  private static instance: TerritoryService;

  private constructor() {}

  static getInstance(): TerritoryService {
    if (!TerritoryService.instance) {
      TerritoryService.instance = new TerritoryService();
    }
    return TerritoryService.instance;
  }

  isClosedLoop(locations: Location[]): boolean {
    if (locations.length < MIN_LOOP_POINTS) return false;

    let pathDistance = 0;
    for (let i = 1; i < locations.length; i++) {
      pathDistance += haversineDistance(
        locations[i - 1].latitude,
        locations[i - 1].longitude,
        locations[i].latitude,
        locations[i].longitude
      );
    }
    if (pathDistance < MIN_LOOP_DISTANCE_METERS) return false;

    const first = locations[0];
    const last = locations[locations.length - 1];
    const closeDistance = haversineDistance(
      first.latitude,
      first.longitude,
      last.latitude,
      last.longitude
    );
    return closeDistance <= LOOP_CLOSE_DISTANCE_METERS;
  }

  getEnclosedPolygon(locations: Location[]): Ring | null {
    if (!this.isClosedLoop(locations)) return null;

    const ring: Ring = locations.map((loc) => [loc.longitude, loc.latitude]);
    ring.push(ring[0]);
    return ring;
  }

  getPolygonArea(ring: Ring): number {
    if (ring.length < 4) return 0;

    const originLat = ring[0][1];
    const metersPerDegLng = METERS_PER_DEGREE_LAT * Math.cos((originLat * Math.PI) / 180);

    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [lng1, lat1] = ring[i];
      const [lng2, lat2] = ring[i + 1];
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
