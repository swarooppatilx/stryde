import { Alert } from '@/utils/alert';

export interface ConfirmDestructiveOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  /** Styles the confirm button as destructive; turn off for a plain "are you sure" such as going private. */
  destructive?: boolean;
}

/** Asks before an action that is hard to take back: a cancel button first, then the confirm, which runs `onConfirm` only if pressed. */
export function confirmDestructive({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  destructive = true,
}: ConfirmDestructiveOptions): void {
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel', onPress: onCancel },
    { text: confirmLabel, style: destructive ? 'destructive' : undefined, onPress: onConfirm },
  ]);
}
