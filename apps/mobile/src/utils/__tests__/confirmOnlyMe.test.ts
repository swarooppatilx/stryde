import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BANNED_USER_WORDS } from '@/constants/copy';

const alert = vi.fn();
vi.mock('@/utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => alert(...args) } }));

const { confirmOnlyMe } = await import('@/utils/confirmOnlyMe');

type Button = { text: string; style?: string; onPress?: () => void };
const buttons = () => alert.mock.calls[0]?.[2] as Button[];
const message = () => alert.mock.calls[0]?.[1] as string;

beforeEach(() => alert.mockReset());

describe('confirmOnlyMe', () => {
  it('says what keeping an activity private costs, and what it does not', () => {
    confirmOnlyMe(vi.fn());

    expect(message()).toContain('stay on this phone');
    expect(message()).toContain("can't be restored");
    expect(message()).toContain('still counts');
  });

  it('keeps to the plain words an athlete uses', () => {
    confirmOnlyMe(vi.fn());

    expect(alert.mock.calls[0]?.[0]).not.toMatch(BANNED_USER_WORDS);
    expect(message()).not.toMatch(BANNED_USER_WORDS);
  });

  it('is not a destructive action: cancel first, then a plain confirm', () => {
    confirmOnlyMe(vi.fn());

    expect(buttons()[0]?.style).toBe('cancel');
    expect(buttons()[1]?.style).toBeUndefined();
  });

  it('makes it private only when the confirm button is pressed', () => {
    const onConfirm = vi.fn();
    confirmOnlyMe(onConfirm);

    expect(onConfirm).not.toHaveBeenCalled();
    buttons()[1]?.onPress?.();
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe('confirmOnlyMe with activities already shared', () => {
  it('says a copy already in the public record stays there', () => {
    confirmOnlyMe(vi.fn(), 2);

    expect(message()).toContain('2 are already in the public record');
    expect(message()).toContain('cannot be taken back');
    expect(message()).not.toMatch(BANNED_USER_WORDS);
  });

  it('says nothing extra when none were shared', () => {
    confirmOnlyMe(vi.fn(), 0);

    expect(message()).not.toContain('public record');
  });
});
