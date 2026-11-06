import { describe, expect, it } from 'vitest';
import type { Location } from '@/types';
import { haversineDistance } from '@/utils/geo';
import { PositionKalman } from '@/utils/kalman';

const LAT = 19.0627;
const LNG = 72.8678;
const M_PER_DEG = 111_320;

function fix(seconds: number, northM: number, eastM: number, accuracy = 5): Location {
  return {
    latitude: LAT + northM / M_PER_DEG,
    longitude: LNG + eastM / (M_PER_DEG * Math.cos((LAT * Math.PI) / 180)),
    timestamp: 1_800_000_000_000 + seconds * 1000,
    accuracy,
  };
}

/** Deterministic, uncorrelated noise in [-1, 1], so the tests do not flake. */
function noise(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

const truth = (s: number) => ({ north: 1.3 * s, east: 0 });

describe('PositionKalman', () => {
  it('returns the first fix as it came', () => {
    const kf = new PositionKalman(1);
    const first = fix(0, 0, 0);
    expect(kf.update(first)).toEqual(first);
  });

  it('lands closer to a straight walk than the noisy fixes it was given', () => {
    const kf = new PositionKalman(1);
    let rawError = 0;
    let filteredError = 0;
    for (let s = 0; s < 60; s++) {
      const real = truth(s);
      const raw = fix(s, real.north + 6 * noise(s), real.east + 6 * noise(s + 100), 8);
      const out = kf.update(raw);
      if (s < 10) continue;
      const exact = fix(s, real.north, real.east);
      rawError += haversineDistance(raw.latitude, raw.longitude, exact.latitude, exact.longitude);
      filteredError += haversineDistance(
        out.latitude,
        out.longitude,
        exact.latitude,
        exact.longitude
      );
    }
    expect(filteredError).toBeLessThan(rawError * 0.7);
  });

  it('learns the walking speed', () => {
    const kf = new PositionKalman(1);
    for (let s = 0; s < 30; s++) kf.update(fix(s, 1.3 * s, 0));
    expect(kf.speed).toBeGreaterThan(1.1);
    expect(kf.speed).toBeLessThan(1.5);
  });

  it('trusts a sharp fix more than a rough one', () => {
    const sharp = new PositionKalman(1);
    const rough = new PositionKalman(1);
    for (let s = 0; s < 10; s++) {
      sharp.update(fix(s, 0, 0));
      rough.update(fix(s, 0, 0));
    }
    const pulledBySharp = sharp.update(fix(10, 10, 0, 3));
    const pulledByRough = rough.update(fix(10, 10, 0, 25));
    const origin = fix(10, 0, 0);
    const moved = (p: Location) =>
      haversineDistance(origin.latitude, origin.longitude, p.latitude, p.longitude);
    expect(moved(pulledBySharp)).toBeGreaterThan(moved(pulledByRough) * 3);
  });

  it('starts over after a long gap instead of coasting on old speed', () => {
    const kf = new PositionKalman(1);
    for (let s = 0; s < 10; s++) kf.update(fix(s, 1.3 * s, 0));
    const after = fix(60, 500, 0);
    expect(kf.update(after)).toEqual(after);
  });
});
