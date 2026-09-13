import { useCallback, useRef } from 'react';
import { ENV } from '@/constants/config';
import { getParsedError } from '@/utils/errors';
import { Toast } from '@/utils/toast';

interface TxResult {
  confirmed: boolean;
  txHash?: `0x${string}`;
  /** Relay-backed writes return this when offline and parked on the retry queue. */
  queued?: boolean;
}

/**
 * Wraps an on-chain write call with centralized Submitting/Confirmed/Failed
 * Toast feedback and decoded revert reasons, so every screen doing a write
 * doesn't need to hand-roll its own busy/error state.
 */
export function useTransactor() {
  const activeKey = useRef<number | null>(null);

  const transact = useCallback(
    async <T extends TxResult>(
      fn: () => Promise<T>,
      labels?: { pending?: string; success?: string },
      /** Optimistic UI: `apply` runs before the tx is sent so the screen
       * updates instantly; `revert` undoes it if the tx fails or reverts. */
      optimistic?: { apply: () => void; revert: () => void }
    ): Promise<T | null> => {
      optimistic?.apply();
      activeKey.current = Toast.loading(labels?.pending ?? 'Submitting transaction...', 0);
      try {
        const result = await fn();
        if (activeKey.current !== null) Toast.remove(activeKey.current);

        if (result.queued) {
          Toast.success("Saved — will submit when you're back online", 3);
          return result;
        }

        if (!result.confirmed) {
          optimistic?.revert();
          Toast.fail("Transaction didn't confirm on-chain", 2.5);
          return result;
        }

        const shortHash = result.txHash ? `${result.txHash.slice(0, 8)}…` : undefined;
        const suffix = ENV.CHAIN_MODE === 'local' || !shortHash ? '' : ` (${shortHash})`;
        Toast.success((labels?.success ?? 'Confirmed') + suffix, 2);
        return result;
      } catch (error) {
        if (activeKey.current !== null) Toast.remove(activeKey.current);
        optimistic?.revert();
        console.error('[useTransactor] Transaction failed:', error);
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
