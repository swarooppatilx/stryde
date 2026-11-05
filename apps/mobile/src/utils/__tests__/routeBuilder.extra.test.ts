import { describe, expect, it } from 'vitest';
import { moveWaypoint, outAndBack } from '@/utils/routeBuilder';

describe('outAndBack', () => {
  it('returns the way it came without doubling the turnaround', () => {
    expect(
      outAndBack([
        [0, 0],
        [1, 0],
        [2, 0],
      ])
    ).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 0],
      [0, 0],
    ]);
    expect(outAndBack([[0, 0]])).toEqual([[0, 0]]);
  });
});

describe('moveWaypoint', () => {
  it('replaces one point and ignores a bad index', () => {
    expect(
      moveWaypoint(
        [
          [0, 0],
          [1, 1],
        ],
        1,
        [5, 5]
      )
    ).toEqual([
      [0, 0],
      [5, 5],
    ]);
    expect(moveWaypoint([[0, 0]], 3, [5, 5])).toEqual([[0, 0]]);
  });
});
