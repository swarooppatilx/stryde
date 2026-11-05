import { confirmDestructive } from '@/utils/confirmDestructive';

/** Asks before unfollowing, so a stray tap can't undo a follow. */
export function confirmUnfollow(name: string, onConfirm: () => void): void {
  confirmDestructive({
    title: `Unfollow ${name}?`,
    message: 'Their activities will no longer appear in your feed.',
    confirmLabel: 'Unfollow',
    onConfirm,
  });
}
