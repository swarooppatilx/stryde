import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTtlCache } from '../cache';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T10:00:00Z'));
});

afterEach(() => vi.useRealTimers());

describe('createTtlCache', () => {
  it('returns what was stored while it is fresh', () => {
    const cache = createTtlCache<string>(1000);
    cache.set('a', 'one');

    vi.advanceTimersByTime(999);

    expect(cache.get('a')).toBe('one');
  });

  it('forgets an entry once it is older than the lifetime', () => {
    const cache = createTtlCache<string>(1000);
    cache.set('a', 'one');

    vi.advanceTimersByTime(1001);

    expect(cache.get('a')).toBeUndefined();
  });

  it('knows nothing about a key it never saw', () => {
    expect(createTtlCache<string>(1000).get('x')).toBeUndefined();
  });

  it('drops the oldest entry when it holds too many', () => {
    const cache = createTtlCache<number>(60_000, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('empties on clear', () => {
    const cache = createTtlCache<number>(60_000);
    cache.set('a', 1);

    cache.clear();

    expect(cache.get('a')).toBeUndefined();
  });
});
