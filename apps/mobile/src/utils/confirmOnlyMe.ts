import { confirmDestructive } from '@/utils/confirmDestructive';

/**
 * Asks before an activity is made Only Me. Its name, photos and route are then kept off the
 * network, which also means nothing can bring them back after a phone change; said before it is
 * chosen, not discovered later. `onConfirm` runs only if they go ahead.
 */
export function confirmOnlyMe(onConfirm: () => void): void {
  confirmDestructive({
    title: 'Keep this activity private?',
    message:
      "Only you will see its name, photos and route. They stay on this phone, so they can't be restored if you switch phones. It still counts toward your totals and rewards.",
    confirmLabel: 'Make private',
    destructive: false,
    onConfirm,
  });
}
