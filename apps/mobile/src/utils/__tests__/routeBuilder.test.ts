import { describe, expect, it } from 'vitest';
import {
  addWaypoint,
  clearWaypoints,
  reverseWaypoints,
  sampleAlong,
  undoWaypoint,
  waypointsDistance,
} from '@/utils/routeBuilder';

const a: [number, number] = [0, 0];
const b: [number, number] = [0.01, 0];
const c: [number, number] = [0.01, 0.01];

describe('route builder points', () => {
  it('adds, undoes and clears without touching the original', () => {
    const one = addWaypoint([], a);
    const two = addWaypoint(one, b);
    expect(one).toEqual([a]);
    expect(undoWaypoint(two)).toEqual([a]);
    expect(undoWaypoint([])).toEqual([]);
    expect(clearWaypoints()).toEqual([]);
  });

  it('reverses the order', () => {
    expect(reverseWaypoints([a, b, c])).toEqual([c, b, a]);
  });

  it('sums straight lines between points in metres', () => {
    expect(waypointsDistance([a])).toBe(0);
    const d = waypointsDistance([a, b]);
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1120);
  });
});

describe('sampleAlong', () => {
  it('keeps short lines as they are', () => {
    expect(sampleAlong([a, b], 5000)).toEqual([a, b]);
  });

  it('adds points along a long straight leg and keeps both ends', () => {
    const out = sampleAlong([a, b], 300);
    expect(out.length).toBeGreaterThan(3);
    expect(out[0]).toEqual(a);
    expect(out.at(-1)).toEqual(b);
  });

  it('caps the number of points', () => {
    expect(sampleAlong([a, [1, 0]], 10, 50).length).toBeLessThanOrEqual(50);
  });
});
