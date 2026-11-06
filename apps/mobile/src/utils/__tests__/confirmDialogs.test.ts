import { beforeEach, describe, expect, it, vi } from 'vitest';

const alert = vi.fn();
vi.mock('@/utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => alert(...args) } }));

const { confirmBlock } = await import('@/utils/confirmBlock');
const { confirmDeleteRoute } = await import('@/utils/confirmDeleteRoute');
const { confirmDiscard } = await import('@/utils/confirmDiscard');
const { confirmLeave } = await import('@/utils/confirmLeave');
const { confirmRetire } = await import('@/utils/confirmRetire');
const { confirmMute } = await import('@/utils/confirmMute');
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
    ['discard', () => confirmDiscard(vi.fn()), 'Are you sure?', 'Discard Changes'],
    [
      'delete a route',
      () => confirmDeleteRoute('Morning loop', vi.fn()),
      'Delete this route?',
      'Delete',
    ],
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

  it('asks before muting, says the athlete is not told, and is a plain (not destructive) confirm', () => {
    const onConfirm = vi.fn();
    confirmMute('Asha', onConfirm);

    expect(title()).toBe('Mute Asha?');
    expect(alert.mock.calls[0]?.[1]).toContain("won't be told");
    expect(buttons()[0]?.style).toBe('cancel');
    expect(buttons()[1]?.text).toBe('Mute');
    expect(buttons()[1]?.style).toBeUndefined();
    expect(onConfirm).not.toHaveBeenCalled();
    buttons()[1]?.onPress?.();
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
