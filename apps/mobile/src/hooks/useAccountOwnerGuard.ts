import { useEffect } from 'react';
import { reapplySandboxSeed } from '@/backends/configure';
import { getOutbox } from '@/backends/outbox/appOutbox';
import { getPlatform } from '@/platform';
import { syncAccountOwner } from '@/services/accountOwner';
import { discardInFlightRun } from '@/services/discardInFlightRun';
import { trackingSession } from '@/services/trackingSession';
import { logger } from '@/utils/logger';
import { resetAccountStores } from '@/utils/resetAccountStores';

/** Keeps one account's local data from reaching the next person who signs in on this phone. */
export function useAccountOwnerGuard(userId: string | null) {
  useEffect(() => {
    syncAccountOwner(getPlatform().storage, userId, async () => {
      await getOutbox().clear();
      await discardInFlightRun(getPlatform().storage, trackingSession);
      resetAccountStores();
      reapplySandboxSeed();
    }).catch((error) => logger.warn('[Account] Could not check the signed-in account', error));
  }, [userId]);
}
