import { describe, expect, it } from 'vitest';
import { createTtlCache } from '../ttlCache.js';

describe('createTtlCache', () => {
  it('returns what was stored until it is older than the lifetime', () => {
    let now = 1_000;
    const cache = createTtlCache<string>(500, 10, () => now);
    cache.set('a', 'one');

    expect(cache.get('a')).toBe('one');
    now += 499;
    expect(cache.get('a')).toBe('one');
    now += 2;
    expect(cache.get('a')).toBeUndefined();
  });

  it('forgets an expired entry for good rather than keeping it around', () => {
    let now = 0;
    const cache = createTtlCache<string>(10, 10, () => now);
    cache.set('a', 'one');
    now = 11;
    expect(cache.get('a')).toBeUndefined();
    now = 0;
    expect(cache.get('a')).toBeUndefined();
  });

  it('drops the oldest entry when it is full, so memory stays bounded', () => {
    const cache = createTtlCache<number>(1_000, 2, () => 0);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('replaces a key in place without evicting anything else', () => {
    const cache = createTtlCache<number>(1_000, 2, () => 0);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 9);

    expect(cache.get('a')).toBe(9);
    expect(cache.get('b')).toBe(2);
  });
});
