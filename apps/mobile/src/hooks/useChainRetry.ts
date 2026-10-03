import { useCallback, useState } from 'react';
import { COPY } from '@/constants/copy';
import { useActivityStore } from '@/stores/activityStore';
import { chainProof } from '@/utils/chainProof';
import { Toast } from '@/utils/toast';
import { usePostRun } from './usePostRun';

/** Lets the owner retry an activity saved locally but not on chain; `canRetry` is false once the chain holds it or this device is not the owner. */
export function useChainRetry(activityId: string | undefined) {
  const { retry } = usePostRun();
  const [busy, setBusy] = useState(false);
  const stored = useActivityStore((s) => s.activities.find((a) => a.id === activityId));
  const canRetry = stored !== undefined && chainProof(stored).state === 'local';

  const run = useCallback(async () => {
    if (!stored || busy) return;
    setBusy(true);
    try {
      const result = await retry(stored);
      if (result.onchainFailed) Toast.fail(COPY.syncRetryFailed);
      else if (result.steps.record.status === 'skipped') Toast.info(COPY.syncNeedsAccount);
      else Toast.success(COPY.syncDone);
    } finally {
      setBusy(false);
    }
  }, [stored, busy, retry]);

  return { canRetry, busy, retry: run };
}
