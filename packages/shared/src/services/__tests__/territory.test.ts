import { describe, expect, it } from 'vitest';
import { computePolygonHash } from '../territory';

describe('computePolygonHash', () => {
  it('returns a 0x-prefixed hash', () => {
    const polygon: Array<[number, number]> = [
      [73.85, 18.52],
      [73.86, 18.52],
      [73.86, 18.53],
      [73.85, 18.53],
    ];
    const hash = computePolygonHash(polygon);
    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('produces consistent hashes for same polygon', () => {
    const polygon: Array<[number, number]> = [
      [73.85, 18.52],
      [73.86, 18.52],
      [73.86, 18.53],
      [73.85, 18.53],
    ];
    const hash1 = computePolygonHash(polygon);
    const hash2 = computePolygonHash(polygon);
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different polygons', () => {
    const polygon1: Array<[number, number]> = [
      [73.85, 18.52],
      [73.86, 18.52],
      [73.86, 18.53],
      [73.85, 18.53],
    ];
    const polygon2: Array<[number, number]> = [
      [74.85, 19.52],
      [74.86, 19.52],
      [74.86, 19.53],
      [74.85, 19.53],
    ];
    const hash1 = computePolygonHash(polygon1);
    const hash2 = computePolygonHash(polygon2);
    expect(hash1).not.toBe(hash2);
  });
});
