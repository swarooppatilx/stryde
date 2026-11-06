import { confirmDestructive } from '@/utils/confirmDestructive';

/** Asks before leaving a form with unsaved edits; `onDiscard` runs only if they choose to leave. */
export function confirmDiscard(onDiscard: () => void): void {
  confirmDestructive({
    title: 'Are you sure?',
    message: "If you go back now, the changes you've made won't be saved.",
    confirmLabel: 'Discard Changes',
    cancelLabel: 'Keep Editing',
    onConfirm: onDiscard,
  });
}
