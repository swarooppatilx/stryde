import { describe, expect, it } from 'vitest';
import type { WatchSample } from '@/platform/ports';
import type { Location } from '@/types';
import { haversineDistance } from '../geo';
import {
  cadenceOf,
  caloriesOf,
  heartRateOf,
  powerOf,
  scaleTrack,
  watchCoverage,
  watchDistanceOf,
  watchDistanceScale,
} from '../watchSamples';

const START = 1_700_000_000_000;
const at = (s: number, fields: Partial<WatchSample> = {}): WatchSample => ({
  t: START + s * 1000,
  ...fields,
});

describe('heartRateOf', () => {
  it('summarises readings and drops glitches', () => {
    const hr = heartRateOf(
      [at(0, { heartRate: 120 }), at(1, { heartRate: 0 }), at(2, { heartRate: 150 }), at(3)],
      START
    );
    expect(hr?.summary).toEqual({ avg: 135, max: 150 });
    expect(hr?.series).toEqual({ t: [0, 2], bpm: [120, 150] });
  });

  it('is undefined without readings', () => {
    expect(heartRateOf([at(0), at(1, { heartRate: 300 })], START)).toBeUndefined();
  });
});

describe('cadence, power and calories', () => {
  const samples = [
    at(0, { cadence: 170, power: 250, calories: 1 }),
    at(1, { cadence: 0, power: 270, calories: 2.4 }),
    at(2, { calories: 1.9 }),
  ];

  it('keeps plausible cadence and power', () => {
    expect(cadenceOf(samples, START)).toEqual({ t: [0], spm: [170] });
    expect(powerOf(samples, START)).toEqual({ avg: 260, series: { t: [0, 1], w: [250, 270] } });
  });

  it('takes the highest running total for calories', () => {
    expect(caloriesOf(samples)).toBe(2);
    expect(caloriesOf([at(0)])).toBeUndefined();
  });
});

describe('watch distance', () => {
  it('reads the last total', () => {
    expect(watchDistanceOf([at(0, { distance: 10 }), at(1, { distance: 25 }), at(2)])).toBe(25);
  });

  it('measures how much of the moving time was streamed', () => {
    const steady = Array.from({ length: 11 }, (_, i) => at(i));
    expect(watchCoverage(steady, 10_000)).toBe(1);
    // A 30 s silence in the middle of a 40 s run.
    expect(watchCoverage([at(0), at(5), at(35), at(40)], 40_000)).toBeCloseTo(0.25);
    expect(watchCoverage([at(0)], 10_000)).toBe(0);
  });

  it('uses the watch only when it streamed and agrees', () => {
    expect(watchDistanceScale(1000, 1050, 0.95)).toBeCloseTo(1.05);
    expect(watchDistanceScale(1000, 1050, 0.5)).toBe(1);
    expect(watchDistanceScale(1000, 2000, 1)).toBe(1);
    expect(watchDistanceScale(1000, undefined, 1)).toBe(1);
    expect(watchDistanceScale(0, 500, 1)).toBe(1);
  });
});

describe('scaleTrack', () => {
  const fix = (lat: number, lng: number, s: number): Location =>
    ({ latitude: lat, longitude: lng, timestamp: START + s * 1000 }) as Location;
  const length = (track: Location[]) =>
    track.slice(1).reduce((sum, to, i) => {
      const from = track[i] as Location;
      return sum + haversineDistance(from.latitude, from.longitude, to.latitude, to.longitude);
    }, 0);

  it('stretches every distance along the track by the scale', () => {
    const track = [fix(18.52, 73.85, 0), fix(18.521, 73.851, 60), fix(18.523, 73.85, 120)];
    const scaled = scaleTrack(track, 1.08);
    expect(length(scaled) / length(track)).toBeCloseTo(1.08, 3);
    expect(scaled[0]).toEqual(track[0]);
    expect(scaled.map((f) => f.timestamp)).toEqual(track.map((f) => f.timestamp));
  });

  it('returns a copy unchanged at scale 1', () => {
    const track = [fix(1, 1, 0), fix(1.001, 1, 10)];
    expect(scaleTrack(track, 1)).toEqual(track);
  });
});
