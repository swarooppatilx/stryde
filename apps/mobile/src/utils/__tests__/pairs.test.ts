import { describe, expect, it } from 'vitest';
import { pairs } from '@/utils/pairs';

describe('pairs', () => {
  it('lists each item with the one after it', () => {
    expect(pairs([1, 2, 3, 4])).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
    ]);
  });

  it('has no pairs for fewer than two items', () => {
    expect(pairs([])).toEqual([]);
    expect(pairs([1])).toEqual([]);
  });
});
