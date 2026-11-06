import { describe, expect, it } from 'vitest';
import {
  encodeGeohash,
  haversineMeters,
  matchSegmentEffort,
  segmentFromTrack,
  type TimedPoint,
} from '../segments';

function straightRun(points: number, startLat = 19.076, lng = 72.8777): TimedPoint[] {
  return Array.from({ length: points }, (_, i) => ({
    latitude: startLat + i * 0.000324,
    longitude: lng,
    timestamp: 1_700_000_000_000 + i * 10_000,
  }));
}

describe('shared segment geometry', () => {
  it('measures a known distance', () => {
    const d = haversineMeters(
      { latitude: 19.076, longitude: 72.8777 },
      { latitude: 19.077, longitude: 72.8777 }
    );
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  it('encodes a known geohash', () => {
    expect(encodeGeohash(19.076, 72.8777, 5)).toBe('te7ud');
  });

  it('times an effort between the gates', () => {
    const run = straightRun(60);
    const segment = segmentFromTrack(run.slice(10, 40));
    if (!segment) throw new Error('segment');
    const elapsed = matchSegmentEffort(run, segment)?.elapsedSec ?? 0;
    expect(elapsed).toBeGreaterThanOrEqual(280);
    expect(elapsed).toBeLessThanOrEqual(320);
  });

  it('rejects a shortcut', () => {
    const segment = segmentFromTrack(straightRun(30, 19.2));
    if (!segment) throw new Error('segment');
    expect(matchSegmentEffort(straightRun(60), segment)).toBeNull();
  });
});
