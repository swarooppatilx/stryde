import { type AlertButton, type AlertOptions, useAlertStore } from '@/stores/alertStore';

export type { AlertButton, AlertOptions };

/** Themed drop-in for `Alert.alert` with the same signature plus optional `options`, rendered by the app's own host instead of the OS dialog. */
export const Alert = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ): void => {
    useAlertStore.getState().show(title, message, buttons, options);
  },
};
