import { COPY } from '@/constants/copy';
import { MAX_AUTO_ATTEMPTS } from './syncSchedule';

/** What to tell the owner about an activity the chain does not hold yet. */
export function syncStatusText(sync: { attempts: number } | undefined): string {
  if (!sync) {
    return COPY.syncPending;
  }
  if (sync.attempts >= MAX_AUTO_ATTEMPTS) {
    return COPY.syncGaveUp;
  }
  return COPY.syncRetrying;
}
