import { describe, expect, it } from 'vitest';
import { countOf, countRegular } from '@/utils/plural';

describe('countOf', () => {
  it('uses the singular for exactly one', () => {
    expect(countOf(1, 'activity', 'activities')).toBe('1 activity');
  });

  it('uses the plural for zero and for many', () => {
    expect(countOf(0, 'activity', 'activities')).toBe('0 activities');
    expect(countOf(2, 'follower', 'followers')).toBe('2 followers');
  });
});

describe('countRegular', () => {
  it('adds an s to a regular noun unless the count is exactly one', () => {
    expect(countRegular(1, 'day')).toBe('1 day');
    expect(countRegular(0, 'day')).toBe('0 days');
    expect(countRegular(3, 'second')).toBe('3 seconds');
  });
});
