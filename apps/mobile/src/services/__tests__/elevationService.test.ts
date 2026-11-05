import { afterEach, describe, expect, it, vi } from 'vitest';
import { getElevationForRoute } from '@/services/elevationService';

const route = (n: number): [number, number][] =>
  Array.from({ length: n }, (_, i) => [73 + i * 1e-4, 18]);

function respondWith(elevations: (batch: number) => number[] | Error) {
  let call = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const result = elevations(call++);
      if (result instanceof Error) throw result;
      return Response.json({ elevation: result });
    })
  );
}

describe('getElevationForRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('has nothing to say about an empty route', async () => {
    expect(await getElevationForRoute([])).toBeNull();
  });

  it('adds up climbs and descents separately', async () => {
    respondWith(() => [100, 110, 105, 130]);

    const data = await getElevationForRoute(route(4));

    expect(data).toMatchObject({
      totalAscent: 35, // +10, +25
      totalDescent: 5,
      minElevation: 100,
      maxElevation: 130,
    });
  });

  describe('vertical jitter deadband', () => {
    it('ignores sub-threshold wiggles on a flat route', async () => {
      respondWith(() => [100, 101, 99, 102, 100, 101]);

      const data = await getElevationForRoute(route(6));

      expect(data).toMatchObject({ totalAscent: 0, totalDescent: 0 });
    });

    it('re-arms only at a confirmed turn, so a climb is counted once', async () => {
      // 100 -> 106 is one real 6 m climb; the +1/+1 chatter drifting there is noise.
      respondWith(() => [100, 101, 102, 103, 104, 106, 102]);

      const data = await getElevationForRoute(route(7));

      expect(data).toMatchObject({ totalAscent: 6, totalDescent: 4 });
    });

    it('still counts a genuine descent through the band', async () => {
      respondWith(() => [130, 122, 118, 122]);

      const data = await getElevationForRoute(route(4));

      expect(data).toMatchObject({ totalAscent: 4, totalDescent: 12 });
    });
  });

  it('asks in batches of 100 points', async () => {
    respondWith((batch) => (batch === 0 ? Array(100).fill(10) : Array(50).fill(10)));

    const data = await getElevationForRoute(route(150));

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(data?.elevations).toHaveLength(150);
  });

  it('gives up cleanly when the service is down', async () => {
    respondWith(() => new Error('offline'));

    expect(await getElevationForRoute(route(10))).toBeNull();
  });
});
