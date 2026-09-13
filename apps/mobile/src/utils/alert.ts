import { type AlertButton, useAlertStore } from '@/stores/alertStore';

export type { AlertButton };

/** Drop-in themed replacement for React Native's `Alert.alert` — identical
 * signature, so every existing call site (confirm/cancel prompts, action
 * sheets, plain info alerts) works unchanged by just swapping the import.
 * Backed by our own store/host instead of the OS-native dialog, so it
 * matches the app's theme instead of popping a system alert box. */
export const Alert = {
  alert: (title: string, message?: string, buttons?: AlertButton[]): void => {
    useAlertStore.getState().show(title, message, buttons);
  },
};
