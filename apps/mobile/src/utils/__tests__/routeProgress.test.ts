import { describe, expect, it } from 'vitest';
import type { RoutePoint } from '@/utils/route';
import { cumulativeLengths, routeProgress } from '@/utils/routeProgress';

// About 1 km due east along the equator, so a degree of longitude is ~111 km.
const LINE: RoutePoint[] = [
  [0, 0],
  [0.009, 0],
];

describe('routeProgress', () => {
  it('measures how far along, how far left, and how far off', () => {
    const p = routeProgress([0.003, 0.0001], LINE);
    expect(p?.totalM).toBeCloseTo(1002, -1);
    expect(p?.alongM).toBeCloseTo(334, -1);
    expect(p?.remainingM).toBeCloseTo(668, -1);
    expect(p?.offsetM).toBeCloseTo(11, 0);
  });

  it('keeps an out-and-back on the leg you are on', () => {
    const outAndBack: RoutePoint[] = [
      [0, 0],
      [0.009, 0],
      [0, 0],
    ];
    const cumulative = cumulativeLengths(outAndBack);
    // At the 300 m mark on the way back, after reaching the turnaround (along ~1000 m).
    const back = routeProgress([0.0027, 0], outAndBack, cumulative, 1100);
    expect(back?.alongM).toBeGreaterThan(1500);
    // The same spot early in the run is on the way out.
    const out = routeProgress([0.0027, 0], outAndBack, cumulative, 200);
    expect(out?.alongM).toBeLessThan(400);
  });

  it('has nothing to say about a single point', () => {
    expect(routeProgress([0, 0], [[0, 0]])).toBeNull();
  });
});
