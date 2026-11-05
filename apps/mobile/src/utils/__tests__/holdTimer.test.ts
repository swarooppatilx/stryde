import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHoldTimer } from '@/utils/holdTimer';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createHoldTimer', () => {
  it('completes once the press has been held for the full time', () => {
    const onComplete = vi.fn();
    const hold = createHoldTimer({ durationMs: 1000, onComplete });

    hold.start();
    vi.advanceTimersByTime(999);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the press is let go early', () => {
    const onComplete = vi.fn();
    const hold = createHoldTimer({ durationMs: 1000, onComplete });

    hold.start();
    vi.advanceTimersByTime(600);
    hold.cancel();
    vi.advanceTimersByTime(1000);

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('starts the count again from zero on a new press', () => {
    const onComplete = vi.fn();
    const hold = createHoldTimer({ durationMs: 1000, onComplete });

    hold.start();
    vi.advanceTimersByTime(600);
    hold.cancel();
    hold.start();
    vi.advanceTimersByTime(600);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('counts a repeated start as the same press', () => {
    const onComplete = vi.fn();
    const hold = createHoldTimer({ durationMs: 1000, onComplete });

    hold.start();
    vi.advanceTimersByTime(500);
    hold.start();
    vi.advanceTimersByTime(500);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('ignores a cancel when nothing is being held', () => {
    const hold = createHoldTimer({ durationMs: 1000, onComplete: vi.fn() });

    expect(() => hold.cancel()).not.toThrow();
  });
});
