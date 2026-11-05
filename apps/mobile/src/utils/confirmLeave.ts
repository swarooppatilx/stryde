import { confirmDestructive } from '@/utils/confirmDestructive';

/** Asks before leaving a club or event, so a mis-tap on the Join button cannot quietly undo a join. */
export function confirmLeave(kind: 'club' | 'event', name: string, onConfirm: () => void): void {
  confirmDestructive({
    title: `Leave ${name}?`,
    message: `You can join this ${kind} again later.`,
    confirmLabel: 'Leave',
    cancelLabel: 'Stay',
    onConfirm,
  });
}
