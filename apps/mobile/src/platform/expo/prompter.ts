import type { Prompter } from '@/platform/ports';
import { Alert } from '@/utils/alert';

/** The themed in-app alert, resolved as a yes/no promise. */
export const expoPrompter: Prompter = {
  confirm({ title, message, confirmText, cancelText = 'Not now' }) {
    return new Promise((resolve) => {
      Alert.alert(
        title,
        message,
        [
          { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
          { text: confirmText, onPress: () => resolve(true) },
        ],
        { onDismiss: () => resolve(false) }
      );
    });
  },
};
