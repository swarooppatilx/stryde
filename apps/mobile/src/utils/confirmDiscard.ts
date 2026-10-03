import { confirmDestructive } from '@/utils/confirmDestructive';

/** Asks before leaving a form with unsaved edits; `onDiscard` runs only if they choose to leave. */
export function confirmDiscard(onDiscard: () => void): void {
  confirmDestructive({
    title: 'Discard changes?',
    message: 'You have unsaved changes that will be lost.',
    confirmLabel: 'Discard',
    cancelLabel: 'Keep editing',
    onConfirm: onDiscard,
  });
}
