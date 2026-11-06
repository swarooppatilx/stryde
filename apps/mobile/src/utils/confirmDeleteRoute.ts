import { confirmDestructive } from '@/utils/confirmDestructive';

/** Asks before deleting a saved route: it cannot be recovered, and the name says which one. */
export function confirmDeleteRoute(name: string, onConfirm: () => void): void {
  confirmDestructive({
    title: 'Delete this route?',
    message: name,
    confirmLabel: 'Delete',
    onConfirm,
  });
}
