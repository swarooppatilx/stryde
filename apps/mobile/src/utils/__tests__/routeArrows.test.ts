import { describe, expect, it } from 'vitest';
import { routeArrows } from '@/utils/routeArrows';

const line = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i * 10, y: 0 }));

describe('routeArrows', () => {
  it('spaces arrows evenly along the length of the route, away from both ends', () => {
    const arrows = routeArrows(line(101), 4);
    expect(arrows).toHaveLength(4);
    expect(arrows.map((a) => Math.round(a.x))).toEqual([200, 400, 600, 800]);
    for (const a of arrows) expect(a.y).toBe(0);
  });

  it('points each arrow the way the route is going (0 degrees = east, 90 = south in svg space)', () => {
    const east = routeArrows(line(11), 1)[0];
    expect(east?.angle).toBeCloseTo(0);
    const south = routeArrows(
      Array.from({ length: 11 }, (_, i) => ({ x: 0, y: i * 10 })),
      1
    )[0];
    expect(south?.angle).toBeCloseTo(90);
    const west = routeArrows(
      Array.from({ length: 11 }, (_, i) => ({ x: -i * 10, y: 0 })),
      1
    )[0];
    expect(Math.abs(west?.angle ?? 0)).toBeCloseTo(180);
  });

  it('follows a corner: an arrow after the turn points the new way', () => {
    const l = [
      ...Array.from({ length: 11 }, (_, i) => ({ x: i * 10, y: 0 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 100, y: (i + 1) * 10 })),
    ];
    const [first, second] = routeArrows(l, 2);
    expect(first?.angle).toBeCloseTo(0);
    expect(second?.angle).toBeCloseTo(90);
  });

  it('draws none for a route too short to read an arrow on', () => {
    expect(routeArrows([{ x: 0, y: 0 }], 3)).toEqual([]);
    expect(routeArrows([], 3)).toEqual([]);
    expect(routeArrows(line(3), 3, 500)).toEqual([]);
  });

  it('ignores repeated points when working out where along the route things are', () => {
    const stationary = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 0 },
    ];
    const [a] = routeArrows(stationary, 1);
    expect(a?.x).toBeCloseTo(50);
    expect(Number.isNaN(a?.angle)).toBe(false);
  });
});
