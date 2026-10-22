import { describe, expect, it } from 'vitest';
import type { ActivityStream } from '@/types';
import { paceColorStops, paceGradientStops, rampColor } from '@/utils/paceGradient';

const stream = (speed: number[], d: number[]): ActivityStream => ({
  t: speed.map((_, i) => i * 10),
  speed,
  d,
});

describe('paceGradientStops', () => {
  it('runs from the start to the end of the line, slow = 0 and fast = 1', () => {
    const stops = paceGradientStops(stream([2, 3, 4], [0, 50, 100]), 10);

    expect(stops).toEqual([
      { progress: 0, t: 0 },
      { progress: 0.5, t: 0.5 },
      { progress: 1, t: 1 },
    ]);
  });

  it('keeps progress strictly rising, dropping points where the athlete stood still', () => {
    const stops = paceGradientStops(stream([3, 0, 0, 4], [0, 60, 60, 100]), 10);

    const progress = stops?.map((s) => s.progress) ?? [];
    expect(progress).toEqual([0, 0.6, 1]);
  });

  it('thins a long stream to the number of stops asked for', () => {
    const d = Array.from({ length: 200 }, (_, i) => i * 5);
    const speed = d.map((_, i) => 2 + (i % 7));

    const stops = paceGradientStops(stream(speed, d), 24);

    expect(stops?.length).toBeLessThanOrEqual(24);
    expect(stops?.[0]?.progress).toBe(0);
    expect(stops?.at(-1)?.progress).toBe(1);
  });

  it('has nothing to draw without distances, with one point, or at one steady speed', () => {
    expect(paceGradientStops({ t: [0, 10], speed: [2, 3] }, 10)).toBeNull();
    expect(paceGradientStops(stream([2], [0]), 10)).toBeNull();
    expect(paceGradientStops(stream([3, 3, 3], [0, 50, 100]), 10)).toBeNull();
  });
});

describe('rampColor', () => {
  const colors = ['#000000', '#ff0000', '#ffffff'] as const;

  it('gives the end colours at 0 and 1 and blends in between', () => {
    expect(rampColor(0, colors)).toBe('#000000');
    expect(rampColor(1, colors)).toBe('#ffffff');
    expect(rampColor(0.25, colors)).toBe('#800000');
    expect(rampColor(0.5, colors)).toBe('#ff0000');
  });

  it('clamps out-of-range input', () => {
    expect(rampColor(-1, colors)).toBe('#000000');
    expect(rampColor(2, colors)).toBe('#ffffff');
  });
});

describe('paceColorStops', () => {
  it('colours each stop along the ramp, slow to fast', () => {
    const stops = paceColorStops(stream([2, 4], [0, 100]), ['#000000', '#ffffff'], 10);

    expect(stops).toEqual([
      { progress: 0, color: '#000000' },
      { progress: 1, color: '#ffffff' },
    ]);
  });

  it('has nothing without a recording', () => {
    expect(paceColorStops(undefined, ['#000000', '#ffffff'])).toBeNull();
  });
});
