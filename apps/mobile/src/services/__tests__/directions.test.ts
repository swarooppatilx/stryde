import { describe, expect, it, vi } from 'vitest';
import {
  chunkWaypoints,
  directionsFailure,
  directionsUrl,
  fetchSnappedLine,
  fetchSnappedRoute,
  parseDirections,
  profileFor,
} from '@/services/directions';
import type { RoutePoint } from '@/utils/route';

const ok = (coordinates: RoutePoint[], distance: number) => ({
  code: 'Ok',
  routes: [{ distance, geometry: { type: 'LineString', coordinates } }],
});

describe('profileFor', () => {
  it('rides on cycling routes and everything else on foot', () => {
    expect(profileFor('ride')).toBe('cycling');
    expect(profileFor('run')).toBe('walking');
    expect(profileFor('hike')).toBe('walking');
  });
});

describe('directionsUrl', () => {
  it('asks for the full GeoJSON line through every waypoint', () => {
    expect(
      directionsUrl(
        [
          [73.8, 18.5],
          [73.81, 18.51],
        ],
        'walking',
        'pk.x'
      )
    ).toBe(
      'https://api.mapbox.com/directions/v5/mapbox/walking/73.800000,18.500000;73.810000,18.510000?geometries=geojson&overview=full&steps=false&continue_straight=true&access_token=pk.x'
    );
  });
});

describe('parseDirections', () => {
  it('reads the first route', () => {
    expect(
      parseDirections(
        ok(
          [
            [1, 2],
            [3, 4],
          ],
          120
        )
      )
    ).toEqual({
      coordinates: [
        [1, 2],
        [3, 4],
      ],
      distance: 120,
    });
  });

  it('returns null when Mapbox found no route', () => {
    expect(parseDirections({ code: 'NoRoute', routes: [] })).toBeNull();
    expect(parseDirections(null)).toBeNull();
  });
});

describe('chunkWaypoints', () => {
  it('splits long lists into overlapping pieces', () => {
    const points = Array.from({ length: 30 }, (_, i) => [i, 0] as RoutePoint);
    const chunks = chunkWaypoints(points, 25);
    expect(chunks.map((c) => c.length)).toEqual([25, 6]);
    expect(chunks[1]?.[0]).toEqual(chunks[0]?.at(-1));
  });
});

describe('fetchSnappedLine', () => {
  it('joins the pieces without repeating their joints', async () => {
    const points = Array.from({ length: 30 }, (_, i) => [i, 0] as RoutePoint);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          ok(
            [
              [0, 0],
              [24, 0],
            ],
            100
          ),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          ok(
            [
              [24, 0],
              [29, 0],
            ],
            50
          ),
      });
    const line = await fetchSnappedLine(points, 'walking', {
      token: 'pk.x',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(line).toEqual({
      coordinates: [
        [0, 0],
        [24, 0],
        [29, 0],
      ],
      distance: 150,
    });
  });

  it('gives up without a token or when a piece fails', async () => {
    const two: RoutePoint[] = [
      [0, 0],
      [1, 1],
    ];
    expect(await fetchSnappedLine(two, 'walking', { token: '' })).toBeNull();
    const failing = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(
      await fetchSnappedLine(two, 'walking', {
        token: 'pk.x',
        fetchImpl: failing as unknown as typeof fetch,
      })
    ).toBeNull();
  });
});

describe('failure reasons', () => {
  it('reads Mapbox error codes', () => {
    expect(directionsFailure({ code: 'Ok' })).toBeNull();
    expect(directionsFailure({ code: 'NoSegment' }, 422)).toBe('unreachable-point');
    expect(directionsFailure({ code: 'NoRoute' })).toBe('no-route');
    expect(
      directionsFailure(
        { code: 'InvalidInput', message: 'Route exceeds maximum distance limitation' },
        422
      )
    ).toBe('too-far');
  });

  it('reports no connection as offline', async () => {
    const failing = vi.fn().mockRejectedValue(new TypeError('Network request failed'));
    const result = await fetchSnappedRoute(
      [
        [0, 0],
        [1, 1],
      ],
      'walking',
      { token: 'pk.x', fetchImpl: failing as unknown as typeof fetch }
    );
    expect(result).toEqual({ ok: false, reason: 'offline' });
  });
});
