import { SETUP_COPY } from '@/constants/copy';
import { Alert } from '@/utils/alert';

/** Asks before leaving setup out, so a stray tap does not lose the guidance. */
export function confirmSkipSetup(onSkip: () => void): void {
  const { title, message, stay, skip } = SETUP_COPY.skipConfirm;
  Alert.alert(title, message, [
    { text: stay, style: 'cancel' },
    { text: skip, onPress: onSkip },
  ]);
}
