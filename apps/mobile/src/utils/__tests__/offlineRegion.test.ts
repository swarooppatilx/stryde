import { describe, expect, it } from 'vitest';
import { offlineBounds, offlinePackName } from '@/utils/offlineRegion';

describe('offlineBounds', () => {
  it('pads the route box on every side, north-east corner first', () => {
    const bounds = offlineBounds(
      [
        [73.85, 18.5],
        [73.87, 18.53],
      ],
      1113.2
    );
    expect(bounds).not.toBeNull();
    const [[neLng, neLat], [swLng, swLat]] = bounds as [[number, number], [number, number]];
    expect(neLat).toBeCloseTo(18.54, 3);
    expect(swLat).toBeCloseTo(18.49, 3);
    expect(neLng).toBeGreaterThan(73.88);
    expect(swLng).toBeLessThan(73.84);
  });

  it('has nothing to cover without a route', () => {
    expect(offlineBounds([])).toBeNull();
  });
});

describe('offlinePackName', () => {
  it('names a pack after its route', () => {
    expect(offlinePackName('abc')).toBe('route-abc');
  });
});
