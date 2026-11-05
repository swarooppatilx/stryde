import { describe, expect, it } from 'vitest';
import { flyoverDurationMs, flyoverFrames, flyoverZoom, lineLength } from '@/utils/activityFlyover';
import type { RoutePoint } from '@/utils/route';

// A 1 km stretch east, then 1 km north.
const ELL: RoutePoint[] = [
  [73.85, 18.5],
  [73.8595, 18.5],
  [73.8595, 18.509],
];

describe('flyoverFrames', () => {
  it('starts at the start, ends at the finish', () => {
    const frames = flyoverFrames(ELL, 50);
    expect(frames).toHaveLength(50);
    expect(frames[0]?.center).toEqual(ELL[0]);
    expect(frames.at(-1)?.center[0]).toBeCloseTo(73.8595, 6);
    expect(frames.at(-1)?.center[1]).toBeCloseTo(18.509, 6);
  });

  it('faces along the route and turns smoothly at the corner', () => {
    const frames = flyoverFrames(ELL, 100);
    // Heading east at the start.
    expect(frames[2]?.bearing).toBeGreaterThan(80);
    expect(frames[2]?.bearing).toBeLessThan(100);
    // North near the end (0°, or just under 360°).
    const end = frames.at(-5)?.bearing as number;
    expect(Math.min(end, 360 - end)).toBeLessThan(15);
    // No jump between frames bigger than a smoothed share of a right angle.
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1]?.bearing as number;
      const b = frames[i]?.bearing as number;
      const d = Math.abs(((((b - a) % 360) + 540) % 360) - 180);
      expect(d).toBeLessThan(30);
    }
  });

  it('counts the route points already passed', () => {
    const frames = flyoverFrames(ELL, 11);
    expect(frames[0]?.index).toBe(0);
    expect(frames.at(-1)?.index).toBe(2);
  });

  it('has nothing to show for a single point', () => {
    expect(flyoverFrames([[0, 0]])).toEqual([]);
  });
});

describe('sizing', () => {
  it('measures the route and picks a zoom and length to suit', () => {
    expect(lineLength(ELL)).toBeGreaterThan(1900);
    expect(flyoverZoom(2000)).toBeGreaterThan(flyoverZoom(40_000));
    expect(flyoverDurationMs(2000, 1)).toBe(15_000);
    expect(flyoverDurationMs(100_000, 1)).toBe(45_000);
    expect(flyoverDurationMs(10_000, 2)).toBe(15_000);
  });
});
