import { describe, expect, it } from 'vitest';
import { simplifyPath, simplifyToCount } from '@/utils/simplifyPath';

describe('simplifyPath', () => {
  it('drops points along a straight stroke', () => {
    const line = Array.from({ length: 50 }, (_, i) => [i, 0] as [number, number]);
    expect(simplifyPath(line, 1)).toEqual([
      [0, 0],
      [49, 0],
    ]);
  });

  it('keeps the corners of a shape', () => {
    const ell: [number, number][] = [
      [0, 0],
      [5, 0.2],
      [10, 0],
      [10.2, 5],
      [10, 10],
    ];
    expect(simplifyPath(ell, 1)).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
  });
});

describe('simplifyToCount', () => {
  it('keeps no more than the budget, ends included', () => {
    const wiggle = Array.from(
      { length: 300 },
      (_, i) => [i, Math.sin(i / 3) * 20] as [number, number]
    );
    const out = simplifyToCount(wiggle, 24);
    expect(out.length).toBeLessThanOrEqual(24);
    expect(out[0]).toEqual(wiggle[0]);
    expect(out.at(-1)).toEqual(wiggle.at(-1));
  });
});
