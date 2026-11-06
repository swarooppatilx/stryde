import { describe, expect, it } from 'vitest';
import type { Location } from '@/types';
import {
  bearingBetween,
  destinationPoint,
  haversineDistance,
  rejectOutliers,
  smoothLocations,
} from '@/utils/geo';

function loc(overrides: Partial<Location> & Pick<Location, 'latitude' | 'longitude'>): Location {
  return {
    timestamp: 0,
    accuracy: 5,
    ...overrides,
  };
}

describe('haversineDistance', () => {
  it('returns 0 for the same point', () => {
    expect(haversineDistance(0, 0, 0, 0)).toBe(0);
  });

  it('returns ~1 km for coordinates ~1 km apart', () => {
    const dist = haversineDistance(0, 0, 0.009, 0);
    expect(dist).toBeGreaterThan(900);
    expect(dist).toBeLessThan(1100);
  });

  it('returns ~20,000 km for antipodal points', () => {
    const dist = haversineDistance(0, 0, 180, 0);
    expect(dist).toBeGreaterThan(20_000_000);
  });

  it('handles high-latitude coordinates', () => {
    const dist = haversineDistance(89.9, 0, 89.9, 1);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(2000);
  });
});

describe('rejectOutliers', () => {
  it('returns empty array for empty input', () => {
    expect(rejectOutliers([])).toEqual([]);
  });

  it('keeps all points when accuracy is good and speed is reasonable', () => {
    const points: Location[] = [
      loc({ latitude: 0, longitude: 0, timestamp: 0, accuracy: 5 }),
      loc({ latitude: 0.0001, longitude: 0, timestamp: 10_000, accuracy: 5 }),
      loc({ latitude: 0.0002, longitude: 0, timestamp: 20_000, accuracy: 5 }),
    ];
    expect(rejectOutliers(points)).toHaveLength(3);
  });

  it('drops points with accuracy > 30 m', () => {
    const points: Location[] = [
      loc({ latitude: 0, longitude: 0, timestamp: 0, accuracy: 5 }),
      loc({ latitude: 0.0001, longitude: 0, timestamp: 10_000, accuracy: 50 }),
      loc({ latitude: 0.0002, longitude: 0, timestamp: 20_000, accuracy: 5 }),
    ];
    const result = rejectOutliers(points);
    expect(result).toHaveLength(2);
    expect(result[0]?.latitude).toBe(0);
    expect(result[1]?.latitude).toBe(0.0002);
  });

  it('drops first point if its accuracy > 30 m', () => {
    const points: Location[] = [loc({ latitude: 0, longitude: 0, timestamp: 0, accuracy: 50 })];
    expect(rejectOutliers(points)).toHaveLength(0);
  });

  it('drops points that imply impossible speed (> 25 km/h)', () => {
    const points: Location[] = [
      loc({ latitude: 0, longitude: 0, timestamp: 0, accuracy: 5 }),
      // 1 km away in 1 second = 1000 m/s = 3600 km/h
      loc({ latitude: 0.009, longitude: 0, timestamp: 1000, accuracy: 5 }),
    ];
    const result = rejectOutliers(points);
    expect(result).toHaveLength(1);
    expect(result[0]?.latitude).toBe(0);
  });
});

describe('rejectOutliers against the last kept point', () => {
  const METERS_PER_DEG = 111_320;
  // 2 m/s northward walk, one fix every 10 s
  const walk = (i: number): Location =>
    loc({ latitude: (i * 20) / METERS_PER_DEG, longitude: 0, timestamp: i * 10_000 });

  it('drops only the glitched fix, not the good fix after it', () => {
    const points = [
      walk(0),
      walk(1),
      // one wild fix 2 km east, then the walk carries on
      loc({ latitude: walk(2).latitude, longitude: 0.018, timestamp: 20_000 }),
      walk(3),
      walk(4),
    ];

    const kept = rejectOutliers(points);

    expect(kept.map((p) => p.timestamp)).toEqual([0, 10_000, 30_000, 40_000]);
  });

  it('honors a per-activity speed limit instead of a fixed 25 km/h', () => {
    // 10 m/s = 36 km/h: a cyclist, impossible for a runner
    const ride = [0, 1, 2, 3].map((i) =>
      loc({ latitude: (i * 100) / METERS_PER_DEG, longitude: 0, timestamp: i * 10_000 })
    );

    expect(rejectOutliers(ride)).toHaveLength(1);
    expect(rejectOutliers(ride, { maxSpeedMs: 50 / 3.6 })).toHaveLength(4);
  });

  it('re-anchors after repeated rejections so a bad first fix cannot erase the whole track', () => {
    const badFirst = loc({ latitude: 0.5, longitude: 0, timestamp: 0 });
    const real = [1, 2, 3, 4, 5].map((i) => walk(i));

    const kept = rejectOutliers([badFirst, ...real]);

    expect(kept.length).toBeGreaterThanOrEqual(3);
    expect(kept[kept.length - 1]?.timestamp).toBe(50_000);
  });
});

describe('smoothLocations', () => {
  it('returns input unchanged for fewer than 3 points', () => {
    const points: Location[] = [
      loc({ latitude: 1, longitude: 2 }),
      loc({ latitude: 3, longitude: 4 }),
    ];
    expect(smoothLocations(points)).toBe(points);
  });

  it('returns empty array for empty input', () => {
    expect(smoothLocations([])).toEqual([]);
  });

  it('smooths noisy coordinates toward the moving average', () => {
    const points: Location[] = [
      loc({ latitude: 0, longitude: 0, timestamp: 0, accuracy: 5 }),
      loc({ latitude: 1, longitude: 1, timestamp: 1, accuracy: 5 }),
      loc({ latitude: 0, longitude: 0, timestamp: 2, accuracy: 5 }),
      loc({ latitude: 1, longitude: 1, timestamp: 3, accuracy: 5 }),
      loc({ latitude: 0, longitude: 0, timestamp: 4, accuracy: 5 }),
    ];
    const smoothed = smoothLocations(points);
    expect(smoothed).toHaveLength(5);
    // Middle points should be pulled toward neighbors
    expect(smoothed[2]?.latitude).toBeGreaterThan(0);
    expect(smoothed[2]?.latitude).toBeLessThan(1);
  });

  it('preserves timestamps from original locations', () => {
    const points: Location[] = [
      loc({ latitude: 0, longitude: 0, timestamp: 100, accuracy: 5 }),
      loc({ latitude: 1, longitude: 1, timestamp: 200, accuracy: 5 }),
      loc({ latitude: 2, longitude: 2, timestamp: 300, accuracy: 5 }),
    ];
    const smoothed = smoothLocations(points);
    expect(smoothed[0]?.timestamp).toBe(100);
    expect(smoothed[1]?.timestamp).toBe(200);
    expect(smoothed[2]?.timestamp).toBe(300);
  });

  it('weights higher-accuracy points more heavily', () => {
    const points: Location[] = [
      loc({ latitude: 0, longitude: 0, timestamp: 0, accuracy: 1 }),
      loc({ latitude: 10, longitude: 10, timestamp: 1, accuracy: 100 }),
      loc({ latitude: 0, longitude: 0, timestamp: 2, accuracy: 1 }),
    ];
    const smoothed = smoothLocations(points);
    // Middle point should be pulled closer to the accurate neighbors
    expect(smoothed[1]?.latitude).toBeLessThan(2);
  });
});

describe('bearingBetween', () => {
  it('is the compass heading from one point to the next', () => {
    expect(bearingBetween([73.85, 18.52], [73.85, 18.53])).toBeCloseTo(0, 0);
    expect(bearingBetween([73.85, 18.52], [73.86, 18.52])).toBeCloseTo(90, 0);
    expect(bearingBetween([73.85, 18.53], [73.85, 18.52])).toBeCloseTo(180, 0);
    expect(bearingBetween([73.86, 18.52], [73.85, 18.52])).toBeCloseTo(270, 0);
  });
});

describe('destinationPoint', () => {
  const ONE_DEGREE_OF_LATITUDE_M = 111_195;

  it('goes north for a heading of 0 and east for a quarter turn', () => {
    const north = destinationPoint(18, 73, ONE_DEGREE_OF_LATITUDE_M, 0);
    expect(north.latitude).toBeCloseTo(19, 2);
    expect(north.longitude).toBeCloseTo(73, 5);

    const east = destinationPoint(0, 73, ONE_DEGREE_OF_LATITUDE_M, Math.PI / 2);
    expect(east.latitude).toBeCloseTo(0, 5);
    expect(east.longitude).toBeCloseTo(74, 2);
  });

  it('covers more degrees of longitude per metre away from the equator', () => {
    const atEquator = destinationPoint(0, 73, 1000, Math.PI / 2);
    const at60 = destinationPoint(60, 73, 1000, Math.PI / 2);
    expect((at60.longitude - 73) / (atEquator.longitude - 73)).toBeCloseTo(2, 1);
  });

  it('lands where haversine says it travelled, for a step of walking size', () => {
    const next = destinationPoint(18.52, 73.85, 12, Math.PI / 4);
    expect(haversineDistance(18.52, 73.85, next.latitude, next.longitude)).toBeCloseTo(12, 1);
  });

  it('stays put for no distance', () => {
    expect(destinationPoint(18.52, 73.85, 0, 1.2)).toEqual({ latitude: 18.52, longitude: 73.85 });
  });
});
