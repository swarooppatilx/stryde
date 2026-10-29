import { describe, expect, it } from 'vitest';
import { activityCountLine, followCountsLine } from '@/utils/profileSubline';

describe('activityCountLine', () => {
  it('counts activities with the right plural', () => {
    expect(activityCountLine(12)).toBe('12 activities');
    expect(activityCountLine(1)).toBe('1 activity');
    expect(activityCountLine(0)).toBe('0 activities');
  });
});

describe('followCountsLine', () => {
  it('lists followers and following', () => {
    expect(followCountsLine({ followers: 3, following: 5 })).toBe('3 followers · 5 following');
  });

  it('uses the singular for one follower and shows zeros rather than hiding them', () => {
    expect(followCountsLine({ followers: 1, following: 1 })).toBe('1 follower · 1 following');
    expect(followCountsLine({ followers: 0, following: 0 })).toBe('0 followers · 0 following');
  });
});
