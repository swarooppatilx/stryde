import { describe, expect, it } from 'vitest';
import { fitPadding, routeBounds } from '@/utils/routeBounds';

describe('routeBounds', () => {
  it('is the box around every point, as [west, south, east, north]', () => {
    expect(
      routeBounds([
        [73.85, 18.52],
        [73.86, 18.5],
        [73.84, 18.53],
      ])
    ).toEqual([73.84, 18.5, 73.86, 18.53]);
  });

  it('has nothing to frame without two points', () => {
    expect(routeBounds([])).toBeNull();
    expect(routeBounds([[73.85, 18.52]])).toBeNull();
  });

  it('survives a route with far more points than a spread call can take', () => {
    const points: [number, number][] = Array.from({ length: 300_000 }, (_, i) => [
      73 + i / 1e6,
      18 + i / 1e6,
    ]);

    const bounds = routeBounds(points);

    expect(bounds?.[0]).toBe(73);
    expect(bounds?.[3]).toBeCloseTo(18.299999, 5);
  });
});

describe('fitPadding', () => {
  it('keeps the route clear of the sheet at the bottom and the controls at the top', () => {
    expect(fitPadding({ sheetHeight: 400, topInset: 90 })).toEqual({
      top: 90,
      right: 50,
      bottom: 450,
      left: 50,
    });
  });

  it('never pads by a negative amount while the sheet is still unmeasured', () => {
    expect(fitPadding({ sheetHeight: -20, topInset: 90 }).bottom).toBe(50);
  });
});
