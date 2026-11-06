import { encodeGeohash } from '@repo/shared/segments';
import { describe, expect, it } from 'vitest';
import { boundsFromCamera, geohashCellsForBounds } from '@/utils/geohashCells';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };

describe('geohashCellsForBounds', () => {
  it('returns the one cell of a tiny box', () => {
    const cells = geohashCellsForBounds(
      { south: 18.52, west: 73.856, north: 18.521, east: 73.857 },
      4
    );
    expect(cells).toEqual([encodeGeohash(PUNE.latitude, PUNE.longitude, 4)]);
  });

  it('covers every cell a larger box touches, with no repeats', () => {
    const box = { south: 18.3, west: 73.5, north: 18.8, east: 74.2 };
    const cells = geohashCellsForBounds(box, 4, 100);
    expect(new Set(cells).size).toBe(cells.length);
    for (const [lat, lng] of [
      [box.south, box.west],
      [box.south, box.east],
      [box.north, box.west],
      [box.north, box.east],
      [18.55, 73.85],
    ] as const) {
      expect(cells).toContain(encodeGeohash(lat, lng, 4));
    }
  });

  it('starts with the cell in the middle of the box', () => {
    const box = { south: 18.3, west: 73.5, north: 18.8, east: 74.2 };
    const cells = geohashCellsForBounds(box, 4, 100);
    expect(cells[0]).toBe(encodeGeohash(18.55, 73.85, 4));
  });

  it('never returns more cells than the cap, however far out the map is', () => {
    const world = { south: -80, west: -170, north: 80, east: 170 };
    const cells = geohashCellsForBounds(world, 4, 6);
    expect(cells.length).toBeLessThanOrEqual(6);
    expect(cells.length).toBeGreaterThan(0);
  });

  it('keeps the middle when it has to cut', () => {
    const box = { south: 17, west: 72, north: 20, east: 76 };
    const cells = geohashCellsForBounds(box, 4, 4);
    expect(cells).toContain(encodeGeohash(18.5, 74, 4));
  });

  it('returns nothing for a box that is backwards or not a number', () => {
    expect(geohashCellsForBounds({ south: 2, west: 1, north: 1, east: 2 }, 4)).toEqual([]);
    expect(geohashCellsForBounds({ south: 1, west: 3, north: 2, east: 2 }, 4)).toEqual([]);
    expect(geohashCellsForBounds({ south: Number.NaN, west: 1, north: 2, east: 2 }, 4)).toEqual([]);
  });

  it('clamps a box that runs off the map', () => {
    const cells = geohashCellsForBounds({ south: 89, west: 179, north: 95, east: 185 }, 3, 20);
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) expect(cell).toHaveLength(3);
  });
});

describe('boundsFromCamera', () => {
  it('is centred on the camera and shrinks as the map zooms in', () => {
    const wide = boundsFromCamera([73.85, 18.5], 10, 400, 800);
    const close = boundsFromCamera([73.85, 18.5], 14, 400, 800);
    expect((wide.west + wide.east) / 2).toBeCloseTo(73.85, 5);
    expect((wide.south + wide.north) / 2).toBeCloseTo(18.5, 5);
    expect(close.east - close.west).toBeLessThan(wide.east - wide.west);
  });

  it('keeps to the map near the poles and the date line', () => {
    const b = boundsFromCamera([179.9, 89.9], 1, 800, 800);
    expect(b.north).toBeLessThanOrEqual(90);
    expect(b.east).toBeLessThanOrEqual(180);
  });
});
