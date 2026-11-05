import { describe, expect, it } from 'vitest';
import { pointsAtFractions } from '@/utils/colorSegments';
import { splitMarkers } from '@/utils/splitMarkers';

// East along the equator: 0.001 degrees is about 111.2 m.
const line: [number, number][] = Array.from({ length: 41 }, (_, i) => [i * 0.001, 0]);

describe('splitMarkers', () => {
  it('pins the end of each whole split, numbered from 1', () => {
    // The line is about 4.45 km; recorded as 4.45 km, so pins land at 1, 2, 3 and 4 km.
    const length = 40 * 111.195;
    const markers = splitMarkers(line, 1000, length);

    expect(markers.map((m) => m.label)).toEqual(['1', '2', '3', '4']);
    expect(markers[0]?.coordinate[0]).toBeCloseTo(1000 / 111_195, 4);
    expect(markers[3]?.coordinate[0]).toBeCloseTo(4000 / 111_195, 4);
  });

  it('places pins in proportion when the drawn line is shorter than the recorded distance', () => {
    // Recorded 8 km over a line that draws 4.45 km long: split 4 ends half-way along.
    const markers = splitMarkers(line, 1000, 8000);

    expect(markers).toHaveLength(7);
    expect(markers[3]?.coordinate[0]).toBeCloseTo(0.02, 6);
  });

  it('leaves out a split that ends exactly at the finish', () => {
    expect(splitMarkers(line, 1000, 3000).map((m) => m.label)).toEqual(['1', '2']);
  });

  it('leaves out the pin at the finish when float error pushes the total a hair over', () => {
    // Ten 1609.344 m splits add up to 16093.440000000002.
    const total = Array.from({ length: 10 }, () => 1609.344).reduce((a, b) => a + b, 0);

    expect(splitMarkers(line, 1609.344, total)).toHaveLength(9);
  });

  it('works in miles', () => {
    expect(splitMarkers(line, 1609.344, 40 * 111.195).map((m) => m.label)).toEqual(['1', '2']);
  });

  it('is empty for a run shorter than one split, no line, or a bad size', () => {
    expect(splitMarkers(line, 1000, 900)).toEqual([]);
    expect(splitMarkers([[0, 0]], 1000, 5000)).toEqual([]);
    expect(splitMarkers(line, 0, 5000)).toEqual([]);
  });
});

describe('pointsAtFractions', () => {
  it('finds each fraction of the line in one pass', () => {
    const points = pointsAtFractions(line, [0, 0.5, 1]);

    expect(points[0]).toEqual([0, 0]);
    expect(points[1]?.[0]).toBeCloseTo(0.02, 6);
    expect(points[2]?.[0]).toBeCloseTo(0.04, 6);
  });

  it('is empty for a single point or a line of no length', () => {
    expect(pointsAtFractions([[1, 1]], [0.5])).toEqual([]);
    expect(
      pointsAtFractions(
        [
          [1, 1],
          [1, 1],
        ],
        [0.5]
      )
    ).toEqual([]);
  });
});
