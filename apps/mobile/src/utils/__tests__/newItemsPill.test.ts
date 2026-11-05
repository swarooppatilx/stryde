import { describe, expect, it } from 'vitest';
import {
  isScrolledDown,
  latestTime,
  NEW_ITEMS_SCROLL_OFFSET,
  shouldShowNewItemsPill,
} from '@/utils/newItemsPill';

describe('isScrolledDown', () => {
  it('is false near the top and true past the threshold', () => {
    expect(isScrolledDown(0)).toBe(false);
    expect(isScrolledDown(NEW_ITEMS_SCROLL_OFFSET)).toBe(false);
    expect(isScrolledDown(NEW_ITEMS_SCROLL_OFFSET + 1)).toBe(true);
  });

  it('treats the overscroll of a pull-to-refresh as the top', () => {
    expect(isScrolledDown(-80)).toBe(false);
  });
});

describe('latestTime', () => {
  it('is the newest time, wherever it sits in the list', () => {
    expect(latestTime([5, 9, 7])).toBe(9);
  });

  it('is null for an empty list', () => {
    expect(latestTime([])).toBeNull();
  });
});

describe('shouldShowNewItemsPill', () => {
  it('shows when something newer than what the reader saw arrived while scrolled down', () => {
    expect(shouldShowNewItemsPill({ anchorTime: 100, latestTime: 120, scrolledDown: true })).toBe(
      true
    );
  });

  it('stays hidden at the top, where the new item is already in view', () => {
    expect(shouldShowNewItemsPill({ anchorTime: 100, latestTime: 120, scrolledDown: false })).toBe(
      false
    );
  });

  it('stays hidden when nothing is newer', () => {
    expect(shouldShowNewItemsPill({ anchorTime: 100, latestTime: 100, scrolledDown: true })).toBe(
      false
    );
    expect(shouldShowNewItemsPill({ anchorTime: 100, latestTime: 90, scrolledDown: true })).toBe(
      false
    );
  });

  it('stays hidden with nothing to compare against', () => {
    expect(shouldShowNewItemsPill({ anchorTime: null, latestTime: 120, scrolledDown: true })).toBe(
      false
    );
    expect(shouldShowNewItemsPill({ anchorTime: 100, latestTime: null, scrolledDown: true })).toBe(
      false
    );
  });
});
