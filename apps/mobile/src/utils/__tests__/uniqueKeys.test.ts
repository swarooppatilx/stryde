import { describe, expect, it } from 'vitest';
import { uniqueKeys } from '@/utils/uniqueKeys';

describe('uniqueKeys', () => {
  it('uses each value as its own key, so an item keeps its key when others are removed', () => {
    expect(uniqueKeys(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(uniqueKeys(['a', 'c'])).toEqual(['a', 'c']);
  });

  it('tells a repeated value apart by how many times it has appeared', () => {
    expect(uniqueKeys(['a', 'b', 'a', 'a'])).toEqual(['a', 'b', 'a#2', 'a#3']);
  });

  it('is empty for nothing', () => {
    expect(uniqueKeys([])).toEqual([]);
  });
});
