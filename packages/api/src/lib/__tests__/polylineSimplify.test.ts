import { describe, expect, it } from 'vitest';
import { simplifyPolyline } from '../polylineSimplify.js';

/** A gently curving route of `n` points in the `lng,lat;lng,lat` format. */
function curve(n: number): string {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return `${(72.86 + t * 0.02).toFixed(6)},${(19.06 + Math.sin(t * 6) * 0.004).toFixed(6)}`;
  }).join(';');
}

const count = (p: string) => (p ? p.split(';').length : 0);

describe('simplifyPolyline', () => {
  it('leaves a route that is already short enough exactly as it was', () => {
    const short = '72.86,19.06;72.87,19.07;72.88,19.06';
    expect(simplifyPolyline(short, 10)).toBe(short);
  });

  it('never returns more points than asked for', () => {
    for (const max of [8, 20, 50]) {
      expect(count(simplifyPolyline(curve(600), max))).toBeLessThanOrEqual(max);
    }
  });

  it('uses most of the point budget instead of thinning a route to a couple of points', () => {
    for (const max of [20, 50, 200]) {
      expect(count(simplifyPolyline(curve(600), max))).toBeGreaterThanOrEqual(max / 2);
    }
  });

  it('keeps the first and last point so the start and end do not move', () => {
    const route = curve(400);
    const points = route.split(';');
    const simplified = simplifyPolyline(route, 25).split(';');
    expect(simplified[0]).toBe(points[0]);
    expect(simplified.at(-1)).toBe(points.at(-1));
  });

  it('keeps the shape: every kept point is one of the original points', () => {
    const route = curve(300);
    const original = new Set(route.split(';'));
    for (const point of simplifyPolyline(route, 30).split(';')) {
      expect(original.has(point)).toBe(true);
    }
  });

  it('keeps a sharp corner a straight-line cut would lose', () => {
    // An L: east for 100 points, then north for 100. With 3 points the corner must survive.
    const east = Array.from({ length: 100 }, (_, i) => `${72 + i * 0.0001},19`);
    const north = Array.from({ length: 100 }, (_, i) => `${72 + 0.0099},${19 + (i + 1) * 0.0001}`);
    const simplified = simplifyPolyline([...east, ...north].join(';'), 3).split(';');
    expect(simplified).toHaveLength(3);
    expect(simplified[1]).toBe('72.0099,19');
  });

  it('returns an empty string for an empty or unreadable route', () => {
    expect(simplifyPolyline('', 10)).toBe('');
    expect(simplifyPolyline('not;a,route', 10)).toBe('');
  });

  it('is stable: simplifying twice gives the same answer', () => {
    const once = simplifyPolyline(curve(500), 40);
    expect(simplifyPolyline(once, 40)).toBe(once);
  });
});
