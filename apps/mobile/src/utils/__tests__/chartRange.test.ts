import { describe, expect, it } from 'vitest';
import { chartRange } from '@/utils/chartRange';

describe('chartRange', () => {
  it('uses the data range when it is wide enough', () => {
    expect(chartRange([10, 50, 30], 20)).toEqual({ min: 10, max: 50 });
  });

  it('widens a narrow range around its middle so a flat route does not look like a mountain', () => {
    expect(chartRange([100, 104], 20)).toEqual({ min: 92, max: 112 });
  });

  it('centres a perfectly flat series in the minimum range', () => {
    expect(chartRange([50, 50, 50], 20)).toEqual({ min: 40, max: 60 });
  });

  it('keeps the old behaviour with no minimum', () => {
    expect(chartRange([100, 104])).toEqual({ min: 100, max: 104 });
  });
});
