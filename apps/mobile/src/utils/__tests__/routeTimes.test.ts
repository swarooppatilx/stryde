import { describe, expect, it } from 'vitest';
import type { ActivityStream } from '@/types';
import { routeTimes } from '@/utils/routeTimes';

// A straight run north at 3 m/s: 0.00002694 deg of latitude is about 3 m.
const DEG_PER_M = 1 / 111_320;
const route: [number, number][] = [0, 100, 200, 300].map((m) => [77, 12 + m * DEG_PER_M]);
const START = Date.UTC(2026, 9, 21, 6, 0, 0);

const stream = (over: Partial<ActivityStream> = {}): ActivityStream => ({
  t: [0, 50, 100],
  speed: [3, 3, 3],
  d: [0, 150, 300],
  startedAt: START,
  ...over,
});

describe('routeTimes', () => {
  it('gives each route point the time the athlete was there', () => {
    const times = routeTimes(route, stream());

    expect(times?.map((d) => d.getTime() - START)).toEqual(
      [0, 33_333, 66_667, 100_000].map((ms) => expect.closeTo(ms, -2))
    );
  });

  it('stretches to the recorded end so the last point is the finish', () => {
    // The thinned route is a few meters short of the measured distance.
    const times = routeTimes(route, stream({ d: [0, 155, 310] }));

    expect(times?.at(-1)?.getTime()).toBe(START + 100_000);
  });

  it('is unavailable for a stream without distance or a start time (older recordings)', () => {
    expect(routeTimes(route, stream({ d: undefined }))).toBeNull();
    expect(routeTimes(route, stream({ startedAt: undefined }))).toBeNull();
  });

  it('is unavailable for a route too short to place', () => {
    expect(routeTimes([[77, 12]], stream())).toBeNull();
  });
});
