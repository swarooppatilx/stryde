import { encodeGeohash } from '@repo/shared/segments';
import { describe, expect, it, vi } from 'vitest';
import type { Segment } from '@/services/arkivService';
import { cellCentre, exploreSegments, MAX_EXPLORE_CELLS } from '@/services/segmentExplore';

const seg = (key: string): Segment => ({
  key,
  name: key,
  sportType: 0,
  geohash: 'x',
  start: { latitude: 0, longitude: 0 },
  end: { latitude: 0, longitude: 0 },
  distanceM: 500,
  creator: '0x1',
  owner: '0x1',
});

describe('cellCentre', () => {
  it('lies inside the cell it came from', () => {
    const cell = encodeGeohash(18.52, 73.85, 4);
    const c = cellCentre(cell);
    expect(encodeGeohash(c.latitude, c.longitude, 4)).toBe(cell);
  });
});

describe('exploreSegments', () => {
  const box = { south: 18.3, west: 73.5, north: 18.8, east: 74.2 };

  it('asks once per cell and merges duplicates by key', async () => {
    const fetchCell = vi.fn(async () => ({ segments: [seg('a'), seg('b')] }));
    const found = await exploreSegments(box, fetchCell);
    expect(found.map((s) => s.key)).toEqual(['a', 'b']);
    expect(fetchCell.mock.calls.length).toBeGreaterThan(1);
  });

  it('never asks for more cells than the cap', async () => {
    const fetchCell = vi.fn(async () => ({ segments: [] }));
    await exploreSegments({ south: -60, west: -100, north: 60, east: 100 }, fetchCell);
    expect(fetchCell.mock.calls.length).toBeLessThanOrEqual(MAX_EXPLORE_CELLS);
  });

  it('skips a cell that fails and keeps the rest', async () => {
    let n = 0;
    const fetchCell = vi.fn(async () => {
      n += 1;
      if (n === 1) throw new Error('down');
      return { segments: [seg(`s${n}`)] };
    });
    const found = await exploreSegments(box, fetchCell);
    expect(found.length).toBeGreaterThan(0);
  });
});
