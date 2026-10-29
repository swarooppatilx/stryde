import { beforeEach, describe, expect, it, vi } from 'vitest';

const alert = vi.fn();
vi.mock('@/utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => alert(...args) } }));

const { confirmBlock } = await import('@/utils/confirmBlock');
const { confirmDiscard } = await import('@/utils/confirmDiscard');
const { confirmLeave } = await import('@/utils/confirmLeave');
const { confirmRetire } = await import('@/utils/confirmRetire');
const { confirmUnfollow } = await import('@/utils/confirmUnfollow');

type Button = { text: string; style?: string; onPress?: () => void };
const buttons = (): Button[] => alert.mock.calls[0]?.[2] as Button[];
const title = () => alert.mock.calls[0]?.[0] as string;

beforeEach(() => alert.mockReset());

describe('confirm dialogs', () => {
  it.each([
    ['block', () => confirmBlock('Asha', vi.fn()), 'Block Asha?', 'Block'],
    ['unfollow', () => confirmUnfollow('Asha', vi.fn()), 'Unfollow Asha?', 'Unfollow'],
    ['leave a club', () => confirmLeave('club', 'Runners', vi.fn()), 'Leave Runners?', 'Leave'],
    ['discard', () => confirmDiscard(vi.fn()), 'Discard changes?', 'Discard'],
    [
      'retire gear',
      () => confirmRetire('Daily trainers', vi.fn()),
      'Retire Daily trainers?',
      'Retire',
    ],
  ])(
    '%s asks first, with a cancel and a destructive confirm',
    (_name, ask, heading, confirmText) => {
      ask();

      expect(title()).toBe(heading);
      expect(buttons()[0]?.style).toBe('cancel');
      expect(buttons()[1]).toMatchObject({ text: confirmText, style: 'destructive' });
    }
  );

  it('only runs the action when the confirm button is pressed', () => {
    const onConfirm = vi.fn();
    confirmUnfollow('Asha', onConfirm);

    expect(onConfirm).not.toHaveBeenCalled();
    buttons()[1]?.onPress?.();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('names the kind of group in the leave message', () => {
    confirmLeave('event', 'Autumn 50', vi.fn());

    expect(alert.mock.calls[0]?.[1]).toBe('You can join this event again later.');
  });
});
