import { describe, expect, it } from 'vitest';
import { haversineDistance } from '@/utils/geo';
import {
  destinationPoint,
  loopBearings,
  loopWaypoints,
  PATH_WIND_FACTOR,
} from '@/utils/loopRoutes';
import type { RoutePoint } from '@/utils/route';
import { waypointsDistance } from '@/utils/routeBuilder';

const PUNE: RoutePoint = [73.8567, 18.5204];
const dist = (a: RoutePoint, b: RoutePoint) => haversineDistance(a[1], a[0], b[1], b[0]);

describe('destinationPoint', () => {
  it('lands the given distance away in the given direction', () => {
    const north = destinationPoint(PUNE, 0, 1000);
    expect(dist(PUNE, north)).toBeCloseTo(1000, 0);
    expect(north[1]).toBeGreaterThan(PUNE[1]);
    const east = destinationPoint(PUNE, 90, 1000);
    expect(east[0]).toBeGreaterThan(PUNE[0]);
  });
});

describe('loopWaypoints', () => {
  it('starts and ends at the start', () => {
    const loop = loopWaypoints(PUNE, 5000, 45);
    expect(loop[0]).toEqual(PUNE);
    expect(loop.at(-1)).toEqual(PUNE);
    expect(loop).toHaveLength(5);
  });

  it('draws a circle short enough that winding paths make up the distance', () => {
    const loop = loopWaypoints(PUNE, 10_000, 0, 7);
    const drawn = waypointsDistance(loop);
    // A polygon slightly inside the circle of 10 km / wind factor.
    expect(drawn).toBeLessThan(10_000 / PATH_WIND_FACTOR);
    expect(drawn).toBeGreaterThan((10_000 / PATH_WIND_FACTOR) * 0.85);
  });

  it('heads off in the chosen direction', () => {
    const loop = loopWaypoints(PUNE, 5000, 90);
    const far = loop
      .slice(1, -1)
      .reduce((best, p) => (dist(PUNE, p) > dist(PUNE, best) ? p : best));
    expect(far[0]).toBeGreaterThan(PUNE[0]);
  });
});

describe('loopBearings', () => {
  it('spreads three directions a third of a turn apart', () => {
    const [a, b, c] = loopBearings(0);
    expect([a, b, c]).toEqual([0, 120, 240]);
    expect(loopBearings(1)).not.toEqual(loopBearings(0));
  });
});
