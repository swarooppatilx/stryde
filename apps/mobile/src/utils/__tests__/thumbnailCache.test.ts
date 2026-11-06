import { describe, expect, it } from 'vitest';
import { createThumbnailCache, thumbnailKey } from '@/utils/thumbnailCache';

const ROUTE: [number, number][] = [
  [72.86, 19.06],
  [72.87, 19.07],
];
const RING: [number, number][] = [
  [72.86, 19.06],
  [72.87, 19.06],
  [72.87, 19.07],
];

describe('thumbnailKey', () => {
  it('is the same for the same route, territory and theme', () => {
    expect(thumbnailKey(ROUTE, RING, true)).toBe(thumbnailKey([...ROUTE], [...RING], true));
  });

  it('differs when the route, the territory or the theme differs', () => {
    const base = thumbnailKey(ROUTE, RING, true);
    expect(thumbnailKey([...ROUTE, [72.88, 19.06]], RING, true)).not.toBe(base);
    expect(thumbnailKey(ROUTE, null, true)).not.toBe(base);
    expect(thumbnailKey(ROUTE, RING, false)).not.toBe(base);
  });
});

describe('createThumbnailCache', () => {
  it('remembers a picture by key', () => {
    const cache = createThumbnailCache(3);
    cache.set('a', 'file:///a.png');
    expect(cache.get('a')).toBe('file:///a.png');
    expect(cache.get('missing')).toBeUndefined();
  });

  it('drops the least recently used picture once it is full', () => {
    const cache = createThumbnailCache(2);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.get('a');
    cache.set('c', '3');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('1');
    expect(cache.get('c')).toBe('3');
  });
});
