import { describe, expect, it } from 'vitest';
import { elevationWorthShowing } from '@/utils/elevationWorthShowing';

const data = (elevations: number[], totalAscent = 0, totalDescent = 0) => ({
  elevations,
  totalAscent,
  totalDescent,
});

describe('elevationWorthShowing', () => {
  it('hides a flat route, where "0 m up, 0 m down" says nothing', () => {
    expect(elevationWorthShowing(data([558, 559, 560, 559]))).toBe(false);
    expect(elevationWorthShowing(data([558, 558, 558]))).toBe(false);
  });

  it('shows a route with a real climb or descent', () => {
    expect(elevationWorthShowing(data([100, 120, 140], 40, 0))).toBe(true);
    expect(elevationWorthShowing(data([140, 120, 100], 0, 40))).toBe(true);
  });

  it('shows a route whose profile spans several metres even if the totals are small', () => {
    expect(elevationWorthShowing(data([100, 106, 100], 2, 2))).toBe(true);
  });

  it('hides a profile with too few points to draw', () => {
    expect(elevationWorthShowing(data([100], 50, 50))).toBe(false);
    expect(elevationWorthShowing(data([], 0, 0))).toBe(false);
  });
});
