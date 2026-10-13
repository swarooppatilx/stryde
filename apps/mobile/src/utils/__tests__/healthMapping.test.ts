import { describe, expect, it } from 'vitest';
import {
  bodyFromHealth,
  climbOfRoute,
  lengthToMeters,
  massToKg,
  routeFromHealth,
  summariseHeartRate,
} from '@/utils/healthMapping';

const START = Date.parse('2026-10-28T06:00:00Z');
const at = (seconds: number) => new Date(START + seconds * 1000).toISOString();

describe('summariseHeartRate', () => {
  it('gives the average, the highest and the series in seconds since the start', () => {
    const summary = summariseHeartRate(
      [
        { time: at(0), beatsPerMinute: 100 },
        { time: at(60), beatsPerMinute: 140 },
        { time: at(120), beatsPerMinute: 180 },
      ],
      START
    );

    expect(summary?.avg).toBe(140);
    expect(summary?.max).toBe(180);
    expect(summary?.series).toEqual({ t: [0, 60, 120], bpm: [100, 140, 180] });
  });

  it('drops readings no heart can have, and says nothing when none are left', () => {
    expect(
      summariseHeartRate(
        [
          { time: at(0), beatsPerMinute: 0 },
          { time: at(10), beatsPerMinute: 400 },
        ],
        START
      )
    ).toBeNull();
    expect(summariseHeartRate([], START)).toBeNull();
  });

  it('thins a long series to the number of points asked for, keeping the first and last', () => {
    const samples = Array.from({ length: 2000 }, (_, i) => ({
      time: at(i),
      beatsPerMinute: 120 + (i % 10),
    }));

    const summary = summariseHeartRate(samples, START, 100);

    expect(summary?.series.t).toHaveLength(100);
    expect(summary?.series.t[0]).toBe(0);
    expect(summary?.series.t.at(-1)).toBe(1999);
  });

  it('never gives a negative time for a reading that predates the start', () => {
    const summary = summariseHeartRate([{ time: at(-5), beatsPerMinute: 90 }], START);

    expect(summary?.series.t).toEqual([0]);
  });
});

describe('routeFromHealth', () => {
  const point = (i: number, altitude?: number) => ({
    time: at(i),
    latitude: 18.52 + i * 0.0001,
    longitude: 73.85 + i * 0.0001,
    ...(altitude !== undefined && { altitude: { value: altitude, unit: 'meters' as const } }),
  });

  it('turns points into timed fixes with their altitude', () => {
    const route = routeFromHealth([point(0, 560), point(1, 561)]);

    expect(route).toEqual([
      { latitude: 18.52, longitude: 73.85, altitude: 560, timestamp: START },
      { latitude: 18.5201, longitude: 73.8501, altitude: 561, timestamp: START + 1000 },
    ]);
  });

  it('skips points with impossible coordinates, and needs two good points', () => {
    expect(routeFromHealth([point(0), { ...point(1), latitude: 200 }])).toBeNull();
    expect(routeFromHealth([])).toBeNull();
  });

  it('thins a long route, keeping both ends', () => {
    const points = Array.from({ length: 5000 }, (_, i) => point(i));

    const route = routeFromHealth(points, 1500);

    expect(route).toHaveLength(1500);
    expect(route?.[0]?.timestamp).toBe(START);
    expect(route?.at(-1)?.timestamp).toBe(START + 4999 * 1000);
  });
});

describe('climbOfRoute', () => {
  const fixes = (altitudes: number[]) =>
    altitudes.map((altitude, i) => ({
      latitude: 0,
      longitude: 0,
      altitude,
      timestamp: START + i * 1000,
    }));

  it('counts a climb and a descent from the route altitudes', () => {
    const up = Array.from({ length: 30 }, (_, i) => 100 + i);
    const down = Array.from({ length: 30 }, (_, i) => 129 - i);

    const climb = climbOfRoute(fixes([...up, ...down]));

    expect(climb?.gain).toBeGreaterThan(24);
    expect(climb?.loss).toBeGreaterThan(24);
  });

  it('is null when the route carries no altitude', () => {
    expect(
      climbOfRoute(
        Array.from({ length: 30 }, (_, i) => ({ latitude: 0, longitude: 0, timestamp: i }))
      )
    ).toBeNull();
  });
});

describe('bodyFromHealth', () => {
  it('takes the most recent weight, height and resting heart rate', () => {
    const body = bodyFromHealth({
      weights: [
        { time: at(0), weight: { value: 72, unit: 'kilograms' as const } },
        { time: at(100), weight: { value: 70400, unit: 'grams' as const } },
      ],
      heights: [{ time: at(0), height: { value: 1.756, unit: 'meters' as const } }],
      resting: [{ time: at(50), beatsPerMinute: 58 }],
    });

    expect(body).toEqual({ weightKg: 70.4, heightCm: 175.6, restingHeartRate: 58 });
  });

  it('leaves out what is missing or not plausible', () => {
    expect(
      bodyFromHealth({
        weights: [{ time: at(0), weight: { value: 5, unit: 'kilograms' as const } }],
        heights: [],
        resting: [{ time: at(0), beatsPerMinute: 10 }],
      })
    ).toEqual({});
  });
});

describe('unit conversion', () => {
  it('reads lengths and masses in whatever unit they were written', () => {
    expect(lengthToMeters({ value: 5.75, unit: 'feet' })).toBeCloseTo(1.7526, 4);
    expect(lengthToMeters({ value: 2, unit: 'kilometers' })).toBe(2000);
    expect(massToKg({ value: 154, unit: 'pounds' })).toBeCloseTo(69.85, 1);
    expect(massToKg({ value: 70400, unit: 'grams' })).toBeCloseTo(70.4, 5);
  });
});
