import { describe, expect, it } from 'vitest';
import type { Location } from '@/types';
import { haversineDistance, rejectOutliers, smoothLocations } from '@/utils/geo';
import { IncrementalTrack } from '@/utils/incrementalTrack';

/** The slow way the tracker used to work out distance: clean the whole track, then add up its legs. */
function fullDistance(points: Location[], maxSpeedMs: number): number {
  const cleaned = smoothLocations(rejectOutliers(points, { maxSpeedMs }));
  let total = 0;
  for (let i = 1; i < cleaned.length; i++) {
    const a = cleaned[i - 1] as Location;
    const b = cleaned[i] as Location;
    total += haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude);
  }
  return total;
}

/** A small seeded random number generator, so a failing track can be reproduced. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function jitterAccuracy(random: () => number): number {
  if (random() < 0.08) return 45;
  if (random() < 0.05) return 0;
  return 3 + random() * 12;
}

/** A jogging track with GPS noise, a few bad-accuracy fixes, jumps and repeated timestamps. */
function noisyTrack(seed: number, length: number): Location[] {
  const random = rng(seed);
  const points: Location[] = [];
  let lat = 18.52;
  let lng = 73.85;
  let t = 1_700_000_000_000;
  for (let i = 0; i < length; i++) {
    lat += 0.00003 + (random() - 0.5) * 0.00001;
    lng += 0.00002 + (random() - 0.5) * 0.00001;
    t += random() < 0.05 ? 0 : 1000;
    let jitterLat = (random() - 0.5) * 0.00002;
    let jitterLng = (random() - 0.5) * 0.00002;
    if (random() < 0.04) {
      jitterLat += 0.002;
      jitterLng -= 0.002;
    }
    points.push({
      latitude: lat + jitterLat,
      longitude: lng + jitterLng,
      timestamp: t,
      accuracy: jitterAccuracy(random),
    });
  }
  return points;
}

const RUN_MAX_MS = 25 / 3.6;

describe('IncrementalTrack', () => {
  it('has no distance before it has two usable fixes', () => {
    const track = new IncrementalTrack(RUN_MAX_MS);
    expect(track.length).toBe(0);
    track.add({ latitude: 1, longitude: 1, timestamp: 0, accuracy: 5 });
    expect(track.length).toBe(0);
  });

  it.each([1, 2, 3, 4, 5, 6])(
    'matches the full recompute after every fix of a noisy track (seed %i)',
    (seed) => {
      const points = noisyTrack(seed, 160);
      const track = new IncrementalTrack(RUN_MAX_MS);

      points.forEach((point, i) => {
        track.add(point);
        const expected = fullDistance(points.slice(0, i + 1), RUN_MAX_MS);
        expect(track.length).toBeCloseTo(expected, 6);
      });
    }
  );

  it('matches for a fast sport with its own speed limit', () => {
    const points = noisyTrack(9, 120);
    const limit = 120 / 3.6;
    const track = new IncrementalTrack(limit);

    points.forEach((point, i) => {
      track.add(point);
      expect(track.length).toBeCloseTo(fullDistance(points.slice(0, i + 1), limit), 6);
    });
  });

  it('counts the fixes it was given, kept or not', () => {
    const track = new IncrementalTrack(RUN_MAX_MS);
    track.add({ latitude: 1, longitude: 1, timestamp: 0, accuracy: 5 });
    track.add({ latitude: 1, longitude: 1, timestamp: 1000, accuracy: 99 });

    expect(track.fed).toBe(2);
  });

  it('does a small, fixed amount of work per fix however long the track is', () => {
    const points = noisyTrack(3, 20_000);
    const track = new IncrementalTrack(RUN_MAX_MS);
    const started = Date.now();
    for (const point of points) {
      track.add(point);
      void track.length;
    }
    // The old way was quadratic: tens of seconds at this size. This should be well under one.
    expect(Date.now() - started).toBeLessThan(1500);
  });
});
