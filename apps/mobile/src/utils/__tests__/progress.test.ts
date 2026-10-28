import { describe, expect, it } from 'vitest';
import { progressFraction } from '@/utils/progress';

describe('progressFraction', () => {
  it('is how far toward the goal, never past the full bar', () => {
    expect(progressFraction(2500, 5000)).toBe(0.5);
    expect(progressFraction(9000, 5000)).toBe(1);
  });

  it('is empty when nothing is done or there is no goal to measure against', () => {
    expect(progressFraction(0, 5000)).toBe(0);
    expect(progressFraction(100, 0)).toBe(0);
    expect(progressFraction(-5, 5000)).toBe(0);
  });
});
