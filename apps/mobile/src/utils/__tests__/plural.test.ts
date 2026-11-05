import { describe, expect, it } from 'vitest';
import { countOf } from '@/utils/plural';

describe('countOf', () => {
  it('uses the singular for exactly one', () => {
    expect(countOf(1, 'activity', 'activities')).toBe('1 activity');
  });

  it('uses the plural for zero and for many', () => {
    expect(countOf(0, 'activity', 'activities')).toBe('0 activities');
    expect(countOf(2, 'follower', 'followers')).toBe('2 followers');
  });
});
