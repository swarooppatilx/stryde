import { confirmDestructive } from '@/utils/confirmDestructive';

/**
 * Asks before muting: muting hides their activities and posts from the feed, and the
 * athlete is not told. A plain confirm rather than a destructive one, since unmuting undoes it.
 */
export function confirmMute(name: string, onConfirm: () => void): void {
  confirmDestructive({
    title: `Mute ${name}?`,
    message: `Their activities and posts will be hidden from your feed. ${name} won't be told you muted them.`,
    confirmLabel: 'Mute',
    destructive: false,
    onConfirm,
  });
}
