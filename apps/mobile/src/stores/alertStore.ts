import { create } from 'zustand';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AlertOptions {
  /** Runs when the alert is dismissed without pressing a button (backdrop tap or back button). */
  onDismiss?: () => void;
}

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  onDismiss?: () => void;
  show: (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => void;
  hide: () => void;
}

/** Backs the themed `Alert` shim in `@/utils/alert`: a single active dialog rendered by `<AlertHost/>`, mounted once in the root layout. */
export const useAlertStore = create<AlertState>((set) => ({
  visible: false,
  title: '',
  message: undefined,
  buttons: [],
  onDismiss: undefined,
  show: (title, message, buttons, options) =>
    set({
      visible: true,
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
      onDismiss: options?.onDismiss,
    }),
  hide: () => set({ visible: false }),
}));
