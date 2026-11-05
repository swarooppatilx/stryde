import { describe, expect, it } from 'vitest';
import { downsampleRoute, polylineFromMetadata, type RoutePoint } from '@/utils/route';

describe('polylineFromMetadata', () => {
  it('prefers the stored polyline over the coordinate list', () => {
    expect(
      polylineFromMetadata({ polyline: '73.85,18.52;73.86,18.53', coordinates: [[1, 2]] })
    ).toBe('73.85,18.52;73.86,18.53');
  });

  it('falls back to coordinates when no polyline survived', () => {
    expect(
      polylineFromMetadata({
        coordinates: [
          [73.85, 18.52],
          [73.86, 18.53],
        ],
      })
    ).toBe('73.85,18.52;73.86,18.53');
  });

  it('drops malformed coordinate entries instead of emitting NaN pairs', () => {
    expect(
      polylineFromMetadata({
        coordinates: [[73.85, 18.52], [73.86], ['a', 'b'], null, [73.87, 18.54]],
      })
    ).toBe('73.85,18.52;73.87,18.54');
  });

  it('returns an empty string for manual entries and absent metadata', () => {
    expect(polylineFromMetadata(null)).toBe('');
    expect(polylineFromMetadata({})).toBe('');
    expect(polylineFromMetadata({ coordinates: 'not-an-array' })).toBe('');
  });
});

describe('downsampleRoute', () => {
  it('keeps first and last points when thinning', () => {
    const route: RoutePoint[] = Array.from({ length: 100 }, (_, i) => [i, i] as RoutePoint);
    const thinned = downsampleRoute(route, 10);
    expect(thinned.length).toBeLessThanOrEqual(11);
    expect(thinned[0]).toEqual([0, 0]);
    expect(thinned.at(-1)).toEqual([99, 99]);
  });
});
