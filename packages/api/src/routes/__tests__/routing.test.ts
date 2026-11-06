import { describe, expect, it, vi } from 'vitest';
import { createRoutingRoutes } from '../routing.js';

const OK = {
  code: 'Ok',
  routes: [
    {
      distance: 1237.2,
      duration: 989.7,
      geometry: {
        coordinates: [
          [73.856481, 18.520374],
          [73.8565, 18.5206],
        ],
      },
    },
  ],
};

const upstream = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

const post = (app: ReturnType<typeof createRoutingRoutes>, body: unknown) =>
  app.request('/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const PUNE: [number, number][] = [
  [73.8567, 18.5204],
  [73.865, 18.525],
];

describe('POST /routing/route', () => {
  it('snaps two points to the foot network and returns the line, distance and time', async () => {
    const fetchMock = upstream(OK);
    const app = createRoutingRoutes({ fetch: fetchMock, baseUrl: 'https://router.test' });

    const res = await post(app, { profile: 'foot', points: PUNE });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      coordinates: OK.routes[0]?.geometry.coordinates,
      distance: 1237.2,
      duration: 989.7,
    });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    // OSRM takes lng,lat pairs joined by semicolons, and the foot service has its own path.
    expect(url).toContain(
      'https://router.test/routed-foot/route/v1/driving/73.8567,18.5204;73.865,18.525'
    );
    expect(url).toContain('overview=full');
    expect(url).toContain('geometries=geojson');
  });

  it('uses the bike service for a bike profile', async () => {
    const fetchMock = upstream(OK);
    const app = createRoutingRoutes({ fetch: fetchMock, baseUrl: 'https://router.test' });
    await post(app, { profile: 'bike', points: PUNE });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/routed-bike/');
  });

  it.each([
    ['no body', undefined],
    ['an unknown profile', { profile: 'car', points: PUNE }],
    ['one point', { profile: 'foot', points: [PUNE[0]] }],
    ['too many points', { profile: 'foot', points: Array.from({ length: 26 }, () => PUNE[0]) }],
    ['a latitude out of range', { profile: 'foot', points: [PUNE[0], [73.8, 91]] }],
    ['a longitude out of range', { profile: 'foot', points: [PUNE[0], [181, 18]] }],
    ['a point that is not a pair of numbers', { profile: 'foot', points: [PUNE[0], ['a', 'b']] }],
  ])('rejects %s with 400 and never calls the router', async (_name, body) => {
    const fetchMock = upstream(OK);
    const app = createRoutingRoutes({ fetch: fetchMock, baseUrl: 'https://router.test' });
    const res = await post(app, body);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 422 no_route when the points cannot be joined on the network', async () => {
    const app = createRoutingRoutes({
      fetch: upstream({ code: 'NoRoute', routes: [] }),
      baseUrl: 'https://router.test',
    });
    const res = await post(app, { profile: 'foot', points: PUNE });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'no_route' });
  });

  it('treats the 400 OSRM sends for an unroutable pair as no_route, not as an outage', async () => {
    const app = createRoutingRoutes({
      fetch: upstream({ code: 'NoRoute', message: 'Impossible route between points' }, 400),
      baseUrl: 'https://router.test',
    });
    const res = await post(app, { profile: 'foot', points: PUNE });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'no_route' });
  });

  it('answers 502 routing_unavailable when the router is down or times out', async () => {
    const down = createRoutingRoutes({
      fetch: vi.fn(async () => {
        throw new Error('ECONNRESET');
      }),
      baseUrl: 'https://router.test',
    });
    const bad = createRoutingRoutes({
      fetch: upstream({ message: 'busy' }, 503),
      baseUrl: 'https://router.test',
    });
    for (const app of [down, bad]) {
      const res = await post(app, { profile: 'foot', points: PUNE });
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: 'routing_unavailable' });
    }
  });

  it('serves a repeated request from the cache, and never caches a failure', async () => {
    const fetchMock = upstream(OK);
    const app = createRoutingRoutes({ fetch: fetchMock, baseUrl: 'https://router.test' });
    await post(app, { profile: 'foot', points: PUNE });
    await post(app, { profile: 'foot', points: PUNE });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const flaky = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(new Response(JSON.stringify(OK)));
    const retry = createRoutingRoutes({ fetch: flaky, baseUrl: 'https://router.test' });
    expect((await post(retry, { profile: 'foot', points: PUNE })).status).toBe(502);
    expect((await post(retry, { profile: 'foot', points: PUNE })).status).toBe(200);
  });
});
