import { describe, expect, it } from 'vitest';
import type { Split } from '@/types';
import { gradeAdjustedSplits, gradeFactor } from '@/utils/gradeAdjusted';

describe('gradeFactor', () => {
  it('is 1 on the flat', () => {
    expect(gradeFactor(0)).toBe(1);
  });

  it('is above 1 uphill, so the same speed counts for more', () => {
    expect(gradeFactor(0.05)).toBeGreaterThan(1);
    expect(gradeFactor(0.1)).toBeGreaterThan(gradeFactor(0.05));
  });

  it('is below 1 on a gentle downhill, which helps', () => {
    expect(gradeFactor(-0.05)).toBeLessThan(1);
  });

  it('stops helping on a steep descent: braking costs effort again', () => {
    expect(gradeFactor(-0.3)).toBeGreaterThan(gradeFactor(-0.1));
  });

  it('holds still beyond the range the curve was fitted to', () => {
    expect(gradeFactor(0.9)).toBe(gradeFactor(0.45));
    expect(gradeFactor(-0.9)).toBe(gradeFactor(-0.45));
  });
});

const split = (over: Partial<Split>): Split => ({
  index: 1,
  distance: 1000,
  movingTime: 360_000,
  ...over,
});

describe('gradeAdjustedSplits', () => {
  it('speeds up an uphill split and slows a downhill one, leaving a flat one alone', () => {
    const result = gradeAdjustedSplits(
      [
        split({ index: 1, elevation: 50 }),
        split({ index: 2, elevation: -30 }),
        split({ index: 3, elevation: 0 }),
      ],
      'run'
    );

    expect(result?.[0]?.movingTime).toBeLessThan(360_000);
    expect(result?.[1]?.movingTime).toBeGreaterThan(360_000);
    expect(result?.[2]?.movingTime).toBe(360_000);
  });

  it('keeps distance and index', () => {
    const result = gradeAdjustedSplits([split({ index: 4, distance: 800, elevation: 20 })], 'run');

    expect(result?.[0]).toMatchObject({ index: 4, distance: 800 });
  });

  it('is null when no split has an elevation to adjust by', () => {
    expect(gradeAdjustedSplits([split({}), split({ index: 2 })], 'run')).toBeNull();
  });

  it('is null for sports the curve does not describe', () => {
    expect(gradeAdjustedSplits([split({ elevation: 50 })], 'ride')).toBeNull();
    expect(gradeAdjustedSplits([split({ elevation: 50 })], 'swim')).toBeNull();
  });

  it('leaves a split without an elevation as it was', () => {
    const result = gradeAdjustedSplits([split({ elevation: 40 }), split({ index: 2 })], 'run');

    expect(result?.[1]?.movingTime).toBe(360_000);
  });
});
