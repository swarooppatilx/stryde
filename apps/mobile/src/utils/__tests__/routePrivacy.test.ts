import { describe, expect, it } from 'vitest';
import { haversineDistance } from '@/utils/geo';
import { jitteredRadius, publicRoute, trimRouteEnds, trimToZones } from '@/utils/routePrivacy';

// ~11.1 m per 0.0001 degree of latitude.
const line = (points: number): [number, number][] =>
  Array.from({ length: points }, (_, i) => [73.85, 18.52 + i * 0.0001] as [number, number]);

describe('trimRouteEnds', () => {
  it('drops the stretch within the given distance of both the start and the end', () => {
    const route = line(101); // ~1.1 km

    const trimmed = trimRouteEnds(route, 200, 'a');

    // The cut is 200 m plus up to 40% extra at each end.
    expect(trimmed.length).toBeGreaterThan(48);
    expect(trimmed.length).toBeLessThan(70);
    // The first kept point is about 200 m along from where the athlete started.
    expect(trimmed[0]?.[1]).toBeGreaterThan(18.52 + 17 * 0.0001);
    expect(trimmed.at(-1)?.[1]).toBeLessThan(18.52 + 83 * 0.0001);
  });

  it('shares nothing when the route is too short to keep anything private', () => {
    expect(trimRouteEnds(line(20), 200, 'a')).toEqual([]);
  });

  it('leaves the route alone when hiding is off', () => {
    const route = line(10);
    expect(trimRouteEnds(route, 0, 'a')).toEqual(route);
  });
});

// A zone centred on the first point of `line`: 200 m radius covers about 18 points.
const home = { id: 'home', name: 'Home', latitude: 18.52, longitude: 73.85, radius: 200 };

describe('trimToZones', () => {
  it('drops the points at the start (and end) that fall inside a zone', () => {
    const route = line(101);

    const trimmed = trimToZones(route, [home], 'a');

    expect(trimmed.length).toBeGreaterThan(75);
    expect(trimmed.length).toBeLessThan(90);
    expect(trimmed[0]?.[1]).toBeGreaterThan(18.52 + 17 * 0.0001);
    expect(trimmed.at(-1)).toEqual(route.at(-1));
  });

  it('cuts both ends when the route starts and finishes inside zones', () => {
    const route = line(101);
    const work = {
      id: 'w',
      name: 'Work',
      latitude: 18.52 + 100 * 0.0001,
      longitude: 73.85,
      radius: 200,
    };

    const trimmed = trimToZones(route, [home, work], 'a');

    expect(trimmed.length).toBeGreaterThan(55);
    expect(trimmed.length).toBeLessThan(70);
  });

  it('keeps a pass through a zone in the middle of the route (only the ends are private)', () => {
    const mid = {
      id: 'm',
      name: 'Cafe',
      latitude: 18.52 + 50 * 0.0001,
      longitude: 73.85,
      radius: 100,
    };
    const route = line(101);

    expect(trimToZones(route, [mid], 'a')).toEqual(route);
  });

  it('shares nothing when the whole route is inside the zone', () => {
    const everywhere = { ...home, radius: 5000 };

    expect(trimToZones(line(20), [everywhere], 'a')).toEqual([]);
  });

  it('leaves the route alone with no zones', () => {
    const route = line(10);

    expect(trimToZones(route, [], 'a')).toEqual(route);
  });
});

describe('publicRoute', () => {
  it('applies the zones first and then the fixed end trim, and says whether a zone cut anything', () => {
    const route = line(201);

    const both = publicRoute(route, { hideEnds: true, zones: [home], seed: 'a' });
    const zonesOnly = publicRoute(route, { hideEnds: false, zones: [home], seed: 'a' });
    const endsOnly = publicRoute(route, { hideEnds: true, zones: [], seed: 'a' });

    expect(zonesOnly.route.length).toBeLessThan(route.length);
    expect(zonesOnly.cutByZone).toBe(true);
    expect(both.route.length).toBeLessThan(zonesOnly.route.length);
    expect(endsOnly.cutByZone).toBe(false);
  });

  it('is the route itself when nothing is hidden', () => {
    const route = line(10);

    expect(publicRoute(route, { hideEnds: false, zones: [], seed: 'a' })).toEqual({
      route,
      cutByZone: false,
    });
  });

  it('does not count a zone the route never touched', () => {
    const far = { id: 'f', name: 'Far', latitude: 10, longitude: 10, radius: 200 };

    expect(publicRoute(line(10), { hideEnds: false, zones: [far], seed: 'a' }).cutByZone).toBe(
      false
    );
  });
});

describe('jitteredRadius', () => {
  const seeds = Array.from({ length: 200 }, (_, i) => `activity-${i}`);

  it('never cuts less than the configured radius and never more than 40% extra', () => {
    for (const seed of seeds) {
      const radius = jitteredRadius(200, seed);
      expect(radius).toBeGreaterThanOrEqual(200);
      expect(radius).toBeLessThanOrEqual(280);
    }
  });

  it('gives the same distance for the same seed', () => {
    expect(jitteredRadius(400, 'run-1')).toBe(jitteredRadius(400, 'run-1'));
  });

  it('spreads different seeds over many distances', () => {
    const distances = new Set(seeds.map((seed) => jitteredRadius(200, seed)));
    expect(distances.size).toBeGreaterThan(20);
  });

  it('leaves a zero radius alone', () => {
    expect(jitteredRadius(0, 'run-1')).toBe(0);
  });
});

describe('clipped endpoints', () => {
  it('do not all sit on one circle around the zone centre', () => {
    const route = line(201);
    const distances = new Set(
      Array.from({ length: 30 }, (_, i) => {
        const first = trimToZones(route, [home], `run-${i}`)[0] as [number, number];
        return Math.round(haversineDistance(home.latitude, home.longitude, first[1], first[0]));
      })
    );

    expect(distances.size).toBeGreaterThan(5);
  });

  it('are never closer to the centre than the configured radius', () => {
    const route = line(201);
    for (let i = 0; i < 30; i++) {
      const first = trimToZones(route, [home], `run-${i}`)[0] as [number, number];
      expect(haversineDistance(home.latitude, home.longitude, first[1], first[0])).toBeGreaterThan(
        home.radius
      );
    }
  });

  it('cut the same way for the same seed, so a later edit republishes the same route', () => {
    const route = line(201);
    const options = { hideEnds: true, zones: [home], seed: 'run-7' };

    expect(publicRoute(route, options)).toEqual(publicRoute(route, options));
  });

  it('cut the ends by at least the fixed distance, at different lengths per seed', () => {
    const route = line(201);
    const kept = new Set(
      Array.from({ length: 30 }, (_, i) => trimRouteEnds(route, 200, `run-${i}`).length)
    );

    expect(kept.size).toBeGreaterThan(3);
    for (const seed of ['a', 'b', 'c']) {
      const first = trimRouteEnds(route, 200, seed)[0] as [number, number];
      expect(haversineDistance(18.52, 73.85, first[1], first[0])).toBeGreaterThanOrEqual(200);
    }
  });
});

describe('looping start', () => {
  // ~60 m radius circle walked three times (about 1.1 km of path), then a long straight north.
  const circle: [number, number][] = Array.from({ length: 3 * 36 + 1 }, (_, i) => {
    const angle = ((i % 36) * 2 * Math.PI) / 36;
    return [
      73.85 + (60 * Math.sin(angle)) / 105_000,
      18.52 + (60 * (1 - Math.cos(angle))) / 111_000,
    ];
  });
  const straight = line(200).map(([lng, lat]) => [lng, lat + 0.001] as [number, number]);
  const route = [...circle, ...straight];

  it('keeps the first kept point at least the cut distance from the start in a straight line', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const [startLng, startLat] = route[0] as [number, number];
      const kept = trimRouteEnds(route, 200, seed);
      const first = kept[0] as [number, number];
      const last = kept.at(-1) as [number, number];
      const end = route.at(-1) as [number, number];
      expect(haversineDistance(startLat, startLng, first[1], first[0])).toBeGreaterThanOrEqual(200);
      expect(haversineDistance(end[1], end[0], last[1], last[0])).toBeGreaterThanOrEqual(200);
    }
  });

  it('does the same for a privacy zone centred on the start', () => {
    const zone = { id: 'z', name: 'Z', latitude: 18.52, longitude: 73.85, radius: 200 };
    const first = trimToZones(route, [zone], 'a')[0] as [number, number];
    expect(haversineDistance(18.52, 73.85, first[1], first[0])).toBeGreaterThan(200);
  });
});

describe('unusable radius', () => {
  it.each([Number.NaN, -50])('cuts nothing for %s', (bad) => {
    const route = line(20);
    const zone = { id: 'z', name: 'Z', latitude: 18.52, longitude: 73.85, radius: bad };

    expect(trimRouteEnds(route, bad, 'a')).toEqual(route);
    expect(trimToZones(route, [zone], 'a')).toEqual(route);
  });
});
