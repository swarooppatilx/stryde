import { Share } from 'react-native';
import { logger } from '@/utils/logger';
import { Toast } from '@/utils/toast';

/**
 * Opens the system share sheet with a message (a name and a link). It never throws: when the sheet
 * cannot open the athlete is told in `failureText`, and the reason is logged.
 */
export async function shareMessage(message: string, failureText: string): Promise<void> {
  try {
    await Share.share({ message });
  } catch (error) {
    logger.warn('[Share] Failed', error);
    Toast.fail(failureText, 1.5);
  }
}
