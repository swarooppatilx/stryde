import { describe, expect, it } from 'vitest';
import {
  computeSweatScore,
  encodeGeohash,
  matchSegmentEffort,
  segmentFromTrack,
  type TimedPoint,
  toGpx,
} from '../fitness/index.js';

process.env.SWARM_REF_SECRET = 'test-secret-test-secret-test-secret';
const { isSealedReference, openReference, sealReference } = await import('../swarm.js');

function defined<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`expected ${what} to be defined`);
  return value;
}

/** A straight run north along a meridian, one point every 10 s at ~3.6 m/s. */
function straightRun(points: number, startLat = 19.076, lng = 72.8777): TimedPoint[] {
  return Array.from({ length: points }, (_, i) => ({
    latitude: startLat + i * 0.000324,
    longitude: lng,
    timestamp: 1_700_000_000_000 + i * 10_000,
  }));
}

describe('geohash', () => {
  it('encodes a known location', () => {
    expect(encodeGeohash(19.076, 72.8777, 5)).toBe('te7ud');
  });
});

describe('segment matching', () => {
  it('times an effort between the start and end gates', () => {
    const run = straightRun(60);
    const segment = defined(segmentFromTrack(run.slice(10, 40)), 'segment');
    const match = matchSegmentEffort(run, segment);
    const effort = defined(match, 'segment match');
    expect(effort.elapsedSec).toBeGreaterThanOrEqual(280);
    expect(effort.elapsedSec).toBeLessThanOrEqual(320);
  });

  it('does not match a run that never reaches the end gate', () => {
    const run = straightRun(60);
    const segment = defined(segmentFromTrack(straightRun(30, 19.2)), 'segment');
    expect(matchSegmentEffort(run, segment)).toBeNull();
  });
});

describe('sweat score', () => {
  const start = 1_700_000_000_000;
  const end = start + 30 * 60_000;
  const samples = (bpm: number) =>
    Array.from({ length: 30 }, (_, i) => ({ timestamp: start + i * 60_000, bpm }));

  it('verifies a real effort', () => {
    const result = computeSweatScore({
      samples: samples(155),
      activityStart: start,
      activityEnd: end,
      distanceM: 5000,
    });
    expect(result.verified).toBe(true);
    expect(result.score).toBeGreaterThan(60);
  });

  it('flags a resting heart rate during a "run"', () => {
    const result = computeSweatScore({
      samples: samples(68),
      activityStart: start,
      activityEnd: end,
      distanceM: 5000,
    });
    expect(result.verified).toBe(false);
  });

  it('is unverified without wearable data', () => {
    const result = computeSweatScore({
      samples: [],
      activityStart: start,
      activityEnd: end,
      distanceM: 5000,
    });
    expect(result.verified).toBe(false);
    expect(result.sampleCount).toBe(0);
  });
});

describe('GPX', () => {
  it('produces a GPX document with every point', () => {
    const gpx = toGpx('Morning run', straightRun(3));
    expect(gpx).toContain('<gpx');
    expect(gpx.match(/<trkpt /g)).toHaveLength(3);
  });
});

describe('private Swarm references', () => {
  const ref = 'a'.repeat(128);
  const athlete = '0x00000000000000000000000000000000000000a1';

  it('only opens for the owning athlete', () => {
    const sealed = sealReference(ref, athlete);
    expect(isSealedReference(sealed)).toBe(true);
    expect(sealed).not.toContain(ref);
    expect(openReference(sealed, athlete)).toBe(ref);
    expect(() => openReference(sealed, '0x00000000000000000000000000000000000000b2')).toThrow();
  });
});
