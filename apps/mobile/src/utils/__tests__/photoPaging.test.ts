import { describe, expect, it } from 'vitest';
import { pageCounter, pageIndex, pagePosition } from '@/utils/photoPaging';

describe('pageIndex', () => {
  it('is the page whose left edge the scroll is nearest to', () => {
    expect(pageIndex(0, 400, 4)).toBe(0);
    expect(pageIndex(190, 400, 4)).toBe(0);
    expect(pageIndex(210, 400, 4)).toBe(1);
    expect(pageIndex(1200, 400, 4)).toBe(3);
  });

  it('stays inside the photos, even when the scroll bounces past either end', () => {
    expect(pageIndex(-60, 400, 4)).toBe(0);
    expect(pageIndex(5000, 400, 4)).toBe(3);
  });

  it('is 0 when there is nothing to page through or no width yet', () => {
    expect(pageIndex(300, 0, 4)).toBe(0);
    expect(pageIndex(300, 400, 0)).toBe(0);
  });
});

describe('pageCounter', () => {
  it('counts from one', () => {
    expect(pageCounter(0, 4)).toBe('1 of 4');
    expect(pageCounter(3, 4)).toBe('4 of 4');
  });

  it('says nothing for a single photo', () => {
    expect(pageCounter(0, 1)).toBe('');
  });
});

describe('pagePosition', () => {
  it('is the short "2/4" for a corner chip', () => {
    expect(pagePosition(1, 4)).toBe('2/4');
  });

  it('says nothing for a single photo', () => {
    expect(pagePosition(0, 1)).toBe('');
  });
});
