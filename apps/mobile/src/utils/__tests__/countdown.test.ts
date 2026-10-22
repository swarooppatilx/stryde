import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startCountdown } from '@/utils/countdown';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('startCountdown', () => {
  it('counts down to zero one second at a time, then calls done once', () => {
    const ticks: number[] = [];
    const done = vi.fn();

    startCountdown(3, { onTick: (n) => ticks.push(n), onDone: done });

    expect(ticks).toEqual([3]);
    vi.advanceTimersByTime(1000);
    expect(ticks).toEqual([3, 2]);
    vi.advanceTimersByTime(2000);
    expect(ticks).toEqual([3, 2, 1]);
    expect(done).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_000);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('starts at once when there is nothing to count', () => {
    const onTick = vi.fn();
    const done = vi.fn();

    startCountdown(0, { onTick, onDone: done });

    expect(onTick).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('stops quietly when cancelled, never calling done', () => {
    const done = vi.fn();
    const ticks: number[] = [];
    const cancel = startCountdown(5, { onTick: (n) => ticks.push(n), onDone: done });

    vi.advanceTimersByTime(2000);
    cancel();
    vi.advanceTimersByTime(10_000);

    expect(done).not.toHaveBeenCalled();
    expect(ticks).toEqual([5, 4, 3]);
  });

  it('can be cancelled after it already finished without harm', () => {
    const done = vi.fn();
    const cancel = startCountdown(1, { onTick: () => {}, onDone: done });
    vi.advanceTimersByTime(1000);

    expect(() => cancel()).not.toThrow();
    expect(done).toHaveBeenCalledTimes(1);
  });
});
