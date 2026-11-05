import { beforeEach, describe, expect, it, vi } from 'vitest';

const alert = vi.fn();
vi.mock('@/utils/alert', () => ({ Alert: { alert: (...args: unknown[]) => alert(...args) } }));

const { confirmDestructive } = await import('@/utils/confirmDestructive');
const { confirmDeletePost } = await import('@/utils/confirmDeletePost');

type Button = { text: string; style?: string; onPress?: () => void };
const buttons = () => alert.mock.calls[0]?.[2] as Button[];

beforeEach(() => alert.mockReset());

describe('confirmDestructive', () => {
  it('shows the copy with a cancel first and a destructive confirm', () => {
    confirmDestructive({ title: 'T', message: 'M', confirmLabel: 'Go', onConfirm: vi.fn() });

    expect(alert.mock.calls[0]?.slice(0, 2)).toEqual(['T', 'M']);
    expect(buttons()[0]).toMatchObject({ text: 'Cancel', style: 'cancel' });
    expect(buttons()[1]).toMatchObject({ text: 'Go', style: 'destructive' });
  });

  it('uses a custom cancel label and runs the matching callbacks', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    confirmDestructive({
      title: 'T',
      message: 'M',
      confirmLabel: 'Go',
      cancelLabel: 'Stay',
      onConfirm,
      onCancel,
    });

    expect(buttons()[0]?.text).toBe('Stay');
    buttons()[0]?.onPress?.();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
    buttons()[1]?.onPress?.();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('can drop the destructive style', () => {
    confirmDestructive({
      title: 'T',
      message: 'M',
      confirmLabel: 'Go',
      destructive: false,
      onConfirm: vi.fn(),
    });

    expect(buttons()[1]?.style).toBeUndefined();
  });
});

describe('confirmDeletePost', () => {
  it('asks before deleting', () => {
    const onConfirm = vi.fn();
    confirmDeletePost(onConfirm);

    expect(alert.mock.calls[0]?.[0]).toBe('Delete post');
    buttons()[1]?.onPress?.();
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
