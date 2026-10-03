import { useCallback, useRef } from 'react';
import { getChainMode } from '@/constants/config';
import { COPY } from '@/constants/copy';
import { getParsedError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { Toast } from '@/utils/toast';

interface TxResult {
  confirmed: boolean;
  txHash?: `0x${string}`;
  /** Relay-backed writes return this when offline and parked on the retry queue. */
  queued?: boolean;
}

/** Wraps an on-chain write with Submitting/Confirmed/Failed toasts and decoded revert reasons. */
export function useTransactor() {
  const activeKey = useRef<number | null>(null);

  const transact = useCallback(
    async <T extends TxResult>(
      fn: () => Promise<T>,
      labels?: { pending?: string; success?: string },
      /** Optimistic UI: `apply` runs before the tx is sent; `revert` undoes it if the tx fails or reverts. */
      optimistic?: { apply: () => void; revert: () => void }
    ): Promise<T | null> => {
      optimistic?.apply();
      activeKey.current = Toast.loading(labels?.pending ?? COPY.actionPending, 0);
      try {
        const result = await fn();
        if (activeKey.current !== null) Toast.remove(activeKey.current);

        if (result.queued) {
          Toast.success("Saved — will submit when you're back online", 3);
          return result;
        }

        if (!result.confirmed) {
          optimistic?.revert();
          Toast.fail(COPY.actionFailed, 2.5);
          return result;
        }

        const shortHash = result.txHash ? `${result.txHash.slice(0, 8)}…` : undefined;
        const suffix = getChainMode() === 'local' || !shortHash ? '' : ` (${shortHash})`;
        Toast.success((labels?.success ?? 'Confirmed') + suffix, 2);
        return result;
      } catch (error) {
        if (activeKey.current !== null) Toast.remove(activeKey.current);
        optimistic?.revert();
        logger.error('[useTransactor] Transaction failed:', error);
        Toast.fail(getParsedError(error), 3);
        return null;
      } finally {
        activeKey.current = null;
      }
    },
    []
  );

  return { transact };
}
