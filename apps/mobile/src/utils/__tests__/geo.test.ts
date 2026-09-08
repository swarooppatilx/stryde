import { describe, expect, it } from 'vitest';
import type { Location } from '../../types';
import { haversineDistance, rejectOutliers, smoothLocations } from '../geo';

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
    expect(result[0].latitude).toBe(0);
    expect(result[1].latitude).toBe(0.0002);
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
    expect(result[0].latitude).toBe(0);
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
    expect(smoothed[2].latitude).toBeGreaterThan(0);
    expect(smoothed[2].latitude).toBeLessThan(1);
  });

  it('preserves timestamps from original locations', () => {
    const points: Location[] = [
      loc({ latitude: 0, longitude: 0, timestamp: 100, accuracy: 5 }),
      loc({ latitude: 1, longitude: 1, timestamp: 200, accuracy: 5 }),
      loc({ latitude: 2, longitude: 2, timestamp: 300, accuracy: 5 }),
    ];
    const smoothed = smoothLocations(points);
    expect(smoothed[0].timestamp).toBe(100);
    expect(smoothed[1].timestamp).toBe(200);
    expect(smoothed[2].timestamp).toBe(300);
  });

  it('weights higher-accuracy points more heavily', () => {
    const points: Location[] = [
      loc({ latitude: 0, longitude: 0, timestamp: 0, accuracy: 1 }),
      loc({ latitude: 10, longitude: 10, timestamp: 1, accuracy: 100 }),
      loc({ latitude: 0, longitude: 0, timestamp: 2, accuracy: 1 }),
    ];
    const smoothed = smoothLocations(points);
    // Middle point should be pulled closer to the accurate neighbors
    expect(smoothed[1].latitude).toBeLessThan(2);
  });
});
