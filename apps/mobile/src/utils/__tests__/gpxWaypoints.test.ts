import { describe, expect, it } from 'vitest';
import { waypointsFromGpx } from '@/utils/gpxWaypoints';

const gpx = (count: number, wiggle = true) =>
  `<gpx><trk><trkseg>${Array.from(
    { length: count },
    (_, i) =>
      `<trkpt lat="${18.5 + i * 0.0001}" lon="${73.8 + (wiggle ? i * i * 0.000000008 : 0)}"/>`
  ).join('')}</trkseg></trk></gpx>`;

describe('waypointsFromGpx', () => {
  it('keeps a short track as it is, longitude first', () => {
    const result = waypointsFromGpx(gpx(2, false), 24);
    expect(result?.points).toEqual([
      [73.8, 18.5],
      [73.8, 18.5001],
    ]);
    expect(result?.capped).toBe(false);
  });

  it('thins a long track to the cap and says so', () => {
    const result = waypointsFromGpx(gpx(500), 24);
    expect(result?.original).toBe(500);
    expect(result?.points.length).toBeLessThanOrEqual(24);
    expect(result?.points.length).toBeGreaterThan(2);
    expect(result?.capped).toBe(true);
  });

  it('keeps both ends of the track', () => {
    const result = waypointsFromGpx(gpx(500), 24);
    expect(result?.points[0]?.[1]).toBeCloseTo(18.5, 6);
    expect(result?.points.at(-1)?.[1]).toBeCloseTo(18.5 + 499 * 0.0001, 6);
  });

  it('is null for a file that is not a GPX track', () => {
    expect(waypointsFromGpx('<html/>', 24)).toBeNull();
  });
});
