import { describe, expect, it } from 'vitest';
import { nextVisibleCount } from '@/utils/pageSize';

describe('nextVisibleCount', () => {
  it('shows one more page', () => {
    expect(nextVisibleCount(10, 100, 10)).toBe(20);
  });

  it('never shows more than there is', () => {
    expect(nextVisibleCount(10, 14, 10)).toBe(14);
    expect(nextVisibleCount(14, 14, 10)).toBe(14);
  });

  it('starts from nothing shown', () => {
    expect(nextVisibleCount(0, 3, 10)).toBe(3);
  });
});
