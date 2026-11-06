import { confirmDestructive } from '@/utils/confirmDestructive';

/** Asks before retiring gear, since a retired item is no longer offered when saving an activity. */
export function confirmRetire(name: string, onConfirm: () => void): void {
  confirmDestructive({
    title: `Retire ${name}?`,
    message:
      'It stops being offered when you save an activity. The distance it has covered stays on your past activities.',
    confirmLabel: 'Retire',
    cancelLabel: 'Keep',
    onConfirm,
  });
}
