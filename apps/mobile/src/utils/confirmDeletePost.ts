import { confirmDestructive } from '@/utils/confirmDestructive';

/** Asks before a post is deleted, since it is removed for everyone. */
export function confirmDeletePost(onConfirm: () => void): void {
  confirmDestructive({
    title: 'Delete post',
    message: 'This removes your post for everyone.',
    confirmLabel: 'Delete',
    onConfirm,
  });
}
