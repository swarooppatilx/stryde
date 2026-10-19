import { describe, expect, it } from 'vitest';
import {
  clampPan,
  clampScale,
  DISMISS_DISTANCE,
  dismissOpacity,
  shouldDismiss,
} from '@/utils/zoomMath';

describe('clampScale', () => {
  it('never zooms out past the photo or in past four times', () => {
    expect(clampScale(0.4)).toBe(1);
    expect(clampScale(2.5)).toBe(2.5);
    expect(clampScale(9)).toBe(4);
  });
});

describe('clampPan', () => {
  it('lets a zoomed photo move only as far as its edges', () => {
    // 400 wide at 2x is 800: 200 of it overhangs each side.
    expect(clampPan(100, 2, 400)).toBe(100);
    expect(clampPan(300, 2, 400)).toBe(200);
    expect(clampPan(-300, 2, 400)).toBe(-200);
  });

  it('keeps an unzoomed photo in place', () => {
    expect(clampPan(50, 1, 400)).toBe(0);
  });
});

describe('dismiss', () => {
  it('dismisses after a long drag or a quick fling, in either direction', () => {
    expect(shouldDismiss(DISMISS_DISTANCE + 1, 0)).toBe(true);
    expect(shouldDismiss(-(DISMISS_DISTANCE + 1), 0)).toBe(true);
    expect(shouldDismiss(20, 1500)).toBe(true);
    expect(shouldDismiss(20, 100)).toBe(false);
  });

  it('fades the backdrop as the photo is dragged away', () => {
    expect(dismissOpacity(0)).toBe(1);
    expect(dismissOpacity(DISMISS_DISTANCE * 2)).toBeCloseTo(0.2, 5);
    expect(dismissOpacity(5000)).toBeGreaterThanOrEqual(0.2);
  });
});
