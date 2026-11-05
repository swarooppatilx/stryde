import { confirmDestructive } from '@/utils/confirmDestructive';

/** Says what blocking does, then blocks on confirm. */
export function confirmBlock(name: string, onConfirm: () => void): void {
  confirmDestructive({
    title: `Block ${name}?`,
    message:
      "You won't see their activities or posts, and they will be hidden from search and lists on this device. You will also unfollow them.",
    confirmLabel: 'Block',
    onConfirm,
  });
}
