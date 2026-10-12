import { describe, expect, it } from 'vitest';
import type { Location } from '@/types';
import { computeStream, MAX_STREAM_POINTS, plausibleStreamSpeeds } from '@/utils/activityStream';

/** A straight run north at a steady speed, one fix a second. */
function steady(seconds: number, metersPerSecond: number): Location[] {
  const degreesPerMeter = 1 / 111_320;
  return Array.from({ length: seconds + 1 }, (_, s) => ({
    latitude: 12 + s * metersPerSecond * degreesPerMeter,
    longitude: 77,
    timestamp: 1_700_000_000_000 + s * 1000,
    accuracy: 5,
  }));
}

describe('computeStream', () => {
  it('reports the speed the athlete was moving at, by seconds since the start', () => {
    const stream = computeStream(steady(120, 3));

    expect(stream?.t[0]).toBe(0);
    expect(stream?.t.at(-1)).toBe(120);
    for (const speed of stream?.speed.slice(5) ?? []) expect(speed).toBeCloseTo(3, 1);
  });

  it('keeps a stop visible as zero speed', () => {
    const run = steady(60, 3);
    const stopped = run.slice(-1)[0] as Location;
    const standing = Array.from({ length: 30 }, (_, i) => ({
      ...stopped,
      timestamp: stopped.timestamp + (i + 1) * 1000,
    }));

    const stream = computeStream([...run, ...standing]);

    expect(stream?.speed.at(-1)).toBe(0);
  });

  it('caps the number of points so a long recording stays small to store', () => {
    const stream = computeStream(steady(7200, 3));

    expect(stream?.t.length).toBeLessThanOrEqual(MAX_STREAM_POINTS);
    expect(stream?.t.length).toBe(stream?.speed.length);
    expect(stream?.t.at(-1)).toBe(7200);
  });

  it('has nothing to say about fewer than two fixes', () => {
    expect(computeStream([])).toBeUndefined();
    expect(computeStream(steady(0, 3))).toBeUndefined();
  });

  it('records when the first fix happened and how far along the athlete was at each point', () => {
    const fixes = steady(120, 3);
    const stream = computeStream(fixes);

    expect(stream?.startedAt).toBe(fixes[0]?.timestamp);
    expect(stream?.d?.length).toBe(stream?.t.length);
    expect(stream?.d?.[0]).toBe(0);
    expect(stream?.d?.at(-1)).toBeCloseTo(360, -1); // 120 s at 3 m/s
  });
});

describe('plausibleStreamSpeeds', () => {
  it('drops non-finite, negative, and sport-impossible speeds from saved streams', () => {
    expect(plausibleStreamSpeeds([2.5, 8.13, Number.NaN, -1], 'walk')).toEqual([2.5, 0, 0, 0]);
  });

  it('keeps a 60 km/h road-ride sample that a running cap would reject', () => {
    const sample = 60 / 3.6; // fast descent; walkers/runners never see this

    expect(plausibleStreamSpeeds([sample], 'ride')).toEqual([sample]);
    expect(plausibleStreamSpeeds([sample], 'run')[0]).toBe(0);
  });
});

describe('computeStream altitude', () => {
  const withAltitude = (fixes: Location[], altitude: (i: number) => number | undefined) =>
    fixes.map((fix, i) => {
      const value = altitude(i);
      return value === undefined ? fix : { ...fix, altitude: value };
    });

  it('keeps the altitude at each point when the phone gave one', () => {
    const stream = computeStream(withAltitude(steady(60, 3), (i) => 100 + i * 0.5));

    expect(stream?.alt).toHaveLength(stream?.t.length ?? -1);
    expect(stream?.alt?.[0]).toBe(100);
    expect(stream?.alt?.at(-1)).toBe(130);
  });

  it('carries the last known altitude over a fix that had none', () => {
    const stream = computeStream(withAltitude(steady(40, 3), (i) => (i === 20 ? undefined : 200)));

    expect(stream?.alt?.every((a) => a === 200)).toBe(true);
  });

  it('leaves altitude out when there is none to speak of', () => {
    expect(computeStream(steady(60, 3))?.alt).toBeUndefined();
  });

  it('thins altitude with the rest of the stream', () => {
    const stream = computeStream(withAltitude(steady(7200, 3), (i) => 100 + (i % 50)));

    expect(stream?.alt).toHaveLength(MAX_STREAM_POINTS);
  });
});
