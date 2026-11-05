import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDoubleTap } from '@/utils/doubleTap';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(delayMs = 250) {
  const onSingle = vi.fn();
  const onDouble = vi.fn();
  return { tap: createDoubleTap({ onSingle, onDouble, delayMs }), onSingle, onDouble };
}

describe('createDoubleTap', () => {
  it('reports a lone tap as a single tap, once the double-tap window has passed', () => {
    const { tap, onSingle, onDouble } = setup();

    tap();
    expect(onSingle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);

    expect(onSingle).toHaveBeenCalledTimes(1);
    expect(onDouble).not.toHaveBeenCalled();
  });

  it('reports two quick taps as one double tap and no single tap', () => {
    const { tap, onSingle, onDouble } = setup();

    tap();
    vi.advanceTimersByTime(100);
    tap();
    vi.advanceTimersByTime(1000);

    expect(onDouble).toHaveBeenCalledTimes(1);
    expect(onSingle).not.toHaveBeenCalled();
  });

  it('treats two slow taps as two single taps', () => {
    const { tap, onSingle, onDouble } = setup();

    tap();
    vi.advanceTimersByTime(400);
    tap();
    vi.advanceTimersByTime(400);

    expect(onSingle).toHaveBeenCalledTimes(2);
    expect(onDouble).not.toHaveBeenCalled();
  });

  it('does not turn a third quick tap into another double tap', () => {
    const { tap, onSingle, onDouble } = setup();

    tap();
    tap();
    tap();
    vi.advanceTimersByTime(1000);

    expect(onDouble).toHaveBeenCalledTimes(1);
    expect(onSingle).toHaveBeenCalledTimes(1);
  });
});
