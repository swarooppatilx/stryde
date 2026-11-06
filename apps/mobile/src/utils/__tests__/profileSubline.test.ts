import { describe, expect, it } from 'vitest';
import { activityCountLine } from '@/utils/profileSubline';

describe('activityCountLine', () => {
  it('counts activities with the right plural', () => {
    expect(activityCountLine(12)).toBe('12 activities');
    expect(activityCountLine(1)).toBe('1 activity');
    expect(activityCountLine(0)).toBe('0 activities');
  });
});
