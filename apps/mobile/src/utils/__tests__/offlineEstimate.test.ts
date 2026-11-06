import { describe, expect, it } from 'vitest';
import {
  deepestZoomWithinCap,
  estimateRegion,
  formatBytes,
  MAX_REGION_TILES,
  regionAround,
  tileCount,
} from '@/utils/offlineEstimate';

describe('tileCount', () => {
  it('covers the world with one tile at zoom 0 and four at zoom 1', () => {
    const world: [[number, number], [number, number]] = [
      [179.9, 85],
      [-179.9, -85],
    ];
    expect(tileCount(world, 0, 0)).toBe(1);
    expect(tileCount(world, 1, 1)).toBe(4);
    expect(tileCount(world, 0, 1)).toBe(5);
  });

  it('counts at least one tile for a tiny box', () => {
    expect(tileCount(regionAround([73.85, 18.5], 0.01), 12, 12)).toBeGreaterThanOrEqual(1);
  });

  it('grows about fourfold with each extra zoom', () => {
    const box = regionAround([73.85, 18.5], 10);
    const at15 = tileCount(box, 15, 15);
    const at16 = tileCount(box, 16, 16);
    expect(at16 / at15).toBeGreaterThan(3.5);
    expect(at16 / at15).toBeLessThan(4.5);
  });
});

describe('regionAround', () => {
  it('is wider in degrees of longitude away from the equator', () => {
    const [[eastEq], [westEq]] = regionAround([0, 0], 10);
    const [[eastN], [westN]] = regionAround([0, 60], 10);
    expect(eastN - westN).toBeGreaterThan(eastEq - westEq);
  });

  it('stays inside the map', () => {
    const [[east, north], [west, south]] = regionAround([179.99, 85], 50);
    expect(east).toBeLessThanOrEqual(180);
    expect(north).toBeLessThanOrEqual(85.0511);
    expect(west).toBeGreaterThan(-180);
    expect(south).toBeGreaterThan(-85.0511);
  });
});

describe('estimateRegion', () => {
  it('prices imagery above the street map and flags what is over the cap', () => {
    const box = regionAround([73.85, 18.5], 5);
    const map = estimateRegion(box, 10, 14, false);
    const imagery = estimateRegion(box, 10, 14, true);
    expect(imagery.bytes).toBeGreaterThan(map.bytes);
    expect(map.tooLarge).toBe(false);
    expect(estimateRegion(regionAround([73.85, 18.5], 25), 8, 17, false).tooLarge).toBe(true);
  });
});

describe('deepestZoomWithinCap', () => {
  it('keeps the requested depth when it fits', () => {
    expect(deepestZoomWithinCap(regionAround([73.85, 18.5], 2), 10, 14)).toBe(14);
  });

  it('backs off to a shallower depth that fits', () => {
    const box = regionAround([73.85, 18.5], 25);
    const zoom = deepestZoomWithinCap(box, 10, 17);
    expect(zoom).not.toBeNull();
    expect(zoom).toBeLessThan(17);
    expect(tileCount(box, 10, zoom as number)).toBeLessThanOrEqual(MAX_REGION_TILES);
    expect(tileCount(box, 10, (zoom as number) + 1)).toBeGreaterThan(MAX_REGION_TILES);
  });

  it('is null when even the first zoom is too much', () => {
    expect(deepestZoomWithinCap(regionAround([0, 0], 5000), 14, 16)).toBeNull();
  });
});

describe('formatBytes', () => {
  it('picks a readable unit', () => {
    expect(formatBytes(500)).toBe('1 KB');
    expect(formatBytes(2_621_440)).toBe('2.5 MB');
    expect(formatBytes(52_428_800)).toBe('50 MB');
    expect(formatBytes(2_147_483_648)).toBe('2.0 GB');
  });
});
