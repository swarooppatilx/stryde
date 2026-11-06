import { describe, expect, it } from 'vitest';
import type { ActivityStream } from '@/types';
import {
  chartPages,
  elevationScrubTarget,
  elevationSeries,
  heartRateScrubTarget,
  powerScrubTarget,
} from '@/utils/chartPages';

const stream = (over: Partial<ActivityStream> = {}): ActivityStream => ({
  t: [0, 10, 20, 30],
  speed: [2, 3, 3, 2],
  d: [0, 30, 60, 90],
  ...over,
});

describe('elevationSeries', () => {
  it('prefers the altitude recorded with the stream', () => {
    const series = elevationSeries(stream({ alt: [10, 12, 15, 11] }), [1, 2, 3]);
    expect(series).toEqual({ values: [10, 12, 15, 11], times: [0, 10, 20, 30], source: 'stream' });
  });

  it('uses the elevation lookup, spread evenly, when the stream has no altitude', () => {
    const series = elevationSeries(stream(), [5, 6, 7]);
    expect(series).toEqual({ values: [5, 6, 7], times: [0, 1, 2], source: 'service' });
  });

  it('ignores altitude that does not line up with the stream', () => {
    expect(elevationSeries(stream({ alt: [1, 2] }), undefined)).toBeNull();
  });

  it('works without a stream at all', () => {
    expect(elevationSeries(undefined, [5, 6])?.source).toBe('service');
    expect(elevationSeries(undefined, [5])).toBeNull();
    expect(elevationSeries(undefined, undefined)).toBeNull();
  });
});

describe('chartPages', () => {
  it('offers pace for a recording with a stream', () => {
    expect(chartPages({ stream: stream(), activityType: 'run' })).toEqual(['pace']);
  });

  it('adds elevation and heart rate only when there is data for them', () => {
    const rich = stream({
      alt: [1, 2, 3, 4],
      heartRate: { t: [0, 15, 30], bpm: [110, 140, 150] },
    });
    expect(chartPages({ stream: rich, activityType: 'run' })).toEqual([
      'pace',
      'elevation',
      'heartRate',
    ]);
  });

  it('adds a power page after heart rate when the stream carries watts', () => {
    const rich = stream({
      heartRate: { t: [0, 15, 30], bpm: [110, 140, 150] },
      power: { t: [0, 15, 30], w: [180, 220, 210] },
    });
    expect(chartPages({ stream: rich, activityType: 'ride' })).toEqual([
      'pace',
      'heartRate',
      'power',
    ]);
  });

  it('hides power for a single reading or all zeros', () => {
    expect(
      chartPages({ stream: stream({ power: { t: [0], w: [200] } }), activityType: 'ride' })
    ).toEqual(['pace']);
    expect(
      chartPages({ stream: stream({ power: { t: [0, 10], w: [0, 0] } }), activityType: 'ride' })
    ).toEqual(['pace']);
  });

  it('offers elevation alone for an activity with a route lookup but no stream', () => {
    expect(chartPages({ stream: undefined, elevations: [1, 2, 3], activityType: 'run' })).toEqual([
      'elevation',
    ]);
  });

  it('skips pace when every speed is implausible', () => {
    const glitch = stream({ speed: [900, 900, 900, 900] });
    expect(chartPages({ stream: glitch, activityType: 'run' })).toEqual([]);
  });

  it('offers nothing without any data', () => {
    expect(chartPages({ stream: undefined, activityType: 'yoga' })).toEqual([]);
  });
});

describe('elevationScrubTarget', () => {
  it('is the same point when the altitude came with the stream', () => {
    const series = elevationSeries(stream({ alt: [1, 2, 3, 4] }), undefined);
    expect(elevationScrubTarget(series, 2, stream({ alt: [1, 2, 3, 4] }))).toBe(2);
  });

  it('maps a lookup point to the stream point at the same share of the distance', () => {
    const s = stream();
    const series = elevationSeries(s, [5, 6, 7, 8, 9]);
    // Point 2 of 5 is halfway: 45 m of 90.
    expect(elevationScrubTarget(series, 2, s)).toBe(1);
    expect(elevationScrubTarget(series, 4, s)).toBe(3);
  });

  it('has nowhere to point without distances on the stream', () => {
    const s = stream({ d: undefined });
    expect(elevationScrubTarget(elevationSeries(s, [1, 2, 3]), 1, s)).toBeNull();
    expect(elevationScrubTarget(elevationSeries(undefined, [1, 2, 3]), 1, undefined)).toBeNull();
  });

  it('passes a lifted finger through', () => {
    const s = stream({ alt: [1, 2, 3, 4] });
    expect(elevationScrubTarget(elevationSeries(s, undefined), null, s)).toBeNull();
  });
});

describe('heartRateScrubTarget', () => {
  it('finds the stream point nearest in time to a reading', () => {
    const s = stream({ heartRate: { t: [0, 14, 31], bpm: [100, 120, 130] } });
    expect(heartRateScrubTarget(s, 1)).toBe(1);
    expect(heartRateScrubTarget(s, 2)).toBe(3);
  });

  it('passes a lifted finger through, and copes with no readings', () => {
    expect(heartRateScrubTarget(stream(), 0)).toBeNull();
    expect(heartRateScrubTarget(stream(), null)).toBeNull();
  });
});

describe('powerScrubTarget', () => {
  it('finds the stream point nearest in time to a power reading', () => {
    const s = stream({ power: { t: [0, 14, 31], w: [100, 120, 130] } });
    expect(powerScrubTarget(s, 1)).toBe(1);
    expect(powerScrubTarget(s, 2)).toBe(3);
  });

  it('passes a lifted finger through, and copes with no readings', () => {
    expect(powerScrubTarget(stream(), 0)).toBeNull();
    expect(powerScrubTarget(stream(), null)).toBeNull();
  });
});
