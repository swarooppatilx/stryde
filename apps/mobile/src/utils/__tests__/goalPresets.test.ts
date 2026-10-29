import { describe, expect, it } from 'vitest';
import { GOAL_PRESETS, presetFor } from '@/utils/goalPresets';

describe('GOAL_PRESETS', () => {
  it('offers Get moving, Steady and Ambitious with their numbers', () => {
    expect(GOAL_PRESETS.map((p) => [p.title, p.activities, p.distance])).toEqual([
      ['Get moving', 2, 10000],
      ['Steady', 3, 20000],
      ['Ambitious', 5, 40000],
    ]);
  });
});

describe('presetFor', () => {
  it('finds the preset that matches both numbers', () => {
    expect(presetFor(5, 40000)?.id).toBe('ambitious');
  });
  it('is null when only one number matches', () => {
    expect(presetFor(3, 25000)).toBeNull();
  });
});
