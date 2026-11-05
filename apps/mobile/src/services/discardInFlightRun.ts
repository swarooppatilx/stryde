import type { StorageAdapter } from '@/platform';
import { logger } from '@/utils/logger';
import { TRACKING_STORAGE_KEY } from '@/utils/recoverableRun';
import type { FinishResult, SessionStatus } from './trackingSession';

interface Session {
  getSnapshot(): { status: SessionStatus };
  finish(): Promise<FinishResult>;
}

/**
 * Throws away a recording that was never finished: the live session and the copy kept for a restart.
 * Used when an account's data leaves the phone, so the next person to sign in is not offered a
 * stranger's route to save as their own.
 */
export async function discardInFlightRun(storage: StorageAdapter, session: Session): Promise<void> {
  if (session.getSnapshot().status !== 'idle') {
    try {
      await session.finish();
    } catch (error) {
      logger.warn('[Recovery] Could not end the live run', error);
    }
  }
  // After the session, which may write the copy once more as it stops.
  await storage.removeItem(TRACKING_STORAGE_KEY);
}
