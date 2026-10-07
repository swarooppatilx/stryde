import { describe, expect, it } from 'vitest';
import {
  emptyToastStack,
  expireToasts,
  finalizeToast,
  liveToasts,
  MAX_TOASTS,
  nextExpiry,
  removeToast,
  showToast,
  type ToastInput,
  type ToastStack,
} from '@/utils/toastStack';

const input = (over: Partial<ToastInput> = {}): ToastInput => ({
  content: 'Hi',
  kind: 'info',
  duration: 2,
  ...over,
});

function add(stack: ToastStack, over: Partial<ToastInput>, now = 0) {
  return showToast(stack, input(over), now);
}

describe('toastStack', () => {
  it('adds toasts oldest first with unique keys', () => {
    const a = add(emptyToastStack, { content: 'a' });
    const b = add(a.stack, { content: 'b' });
    expect(b.stack.items.map((i) => i.content)).toEqual(['a', 'b']);
    expect(a.key).not.toBe(b.key);
  });

  it('updates a toast with the same id in place', () => {
    const a = add(emptyToastStack, { id: 'x', content: 'Sending', kind: 'loading', duration: 0 });
    const b = add(a.stack, { id: 'x', content: 'Counted', kind: 'success' }, 100);
    expect(b.stack.items).toHaveLength(1);
    expect(b.key).toBe(a.key);
    expect(b.stack.items[0]).toMatchObject({
      content: 'Counted',
      kind: 'success',
      expiresAt: 2100,
    });
  });

  it('keeps at most three live; the oldest start leaving', () => {
    let stack = emptyToastStack;
    for (const c of ['1', '2', '3', '4']) stack = add(stack, { content: c }).stack;
    expect(MAX_TOASTS).toBe(3);
    expect(liveToasts(stack).map((i) => i.content)).toEqual(['2', '3', '4']);
    expect(stack.items.find((i) => i.content === '1')?.exiting).toBe(true);
  });

  it('removes with an exit state, then drops on finalize', () => {
    const a = add(emptyToastStack, {});
    const leaving = removeToast(a.stack, a.key);
    expect(leaving.items[0]?.exiting).toBe(true);
    expect(removeToast(leaving, a.key)).toBe(leaving);
    expect(finalizeToast(leaving, a.key).items).toHaveLength(0);
    expect(removeToast(a.stack, 999)).toBe(a.stack);
  });

  it('a leaving toast with the same id is replaced by a fresh one', () => {
    const a = add(emptyToastStack, { id: 'x' });
    const leaving = removeToast(a.stack, a.key);
    const b = add(leaving, { id: 'x', content: 'again' });
    expect(b.key).not.toBe(a.key);
  });

  it('expires by the injected clock and reports the next expiry', () => {
    const a = add(emptyToastStack, { content: 'short', duration: 1 }, 1000);
    const b = add(a.stack, { content: 'long', duration: 5 }, 1000);
    const c = add(b.stack, { content: 'sticky', duration: 0 }, 1000);
    expect(nextExpiry(c.stack)).toBe(2000);
    expect(expireToasts(c.stack, 1999)).toBe(c.stack);
    const after = expireToasts(c.stack, 2000);
    expect(after.items.map((i) => i.exiting)).toEqual([true, false, false]);
    expect(nextExpiry(after)).toBe(6000);
    expect(nextExpiry(emptyToastStack)).toBeNull();
  });
});
