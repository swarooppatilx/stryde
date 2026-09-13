import { useCallback, useRef } from 'react';
import { ENV } from '@/constants/config';
import { getParsedError } from '@/utils/errors';
import { Toast } from '@/utils/toast';

interface TxResult {
  confirmed: boolean;
  txHash?: `0x${string}`;
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
      labels?: { pending?: string; success?: string }
    ): Promise<T | null> => {
      activeKey.current = Toast.loading(labels?.pending ?? 'Submitting transaction...', 0);
      try {
        const result = await fn();
        if (activeKey.current !== null) Toast.remove(activeKey.current);

        if (!result.confirmed) {
          Toast.fail("Transaction didn't confirm on-chain", 2.5);
          return result;
        }

        const shortHash = result.txHash ? `${result.txHash.slice(0, 8)}…` : undefined;
        const suffix = ENV.CHAIN_MODE === 'local' || !shortHash ? '' : ` (${shortHash})`;
        Toast.success((labels?.success ?? 'Confirmed') + suffix, 2);
        return result;
      } catch (error) {
        if (activeKey.current !== null) Toast.remove(activeKey.current);
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
