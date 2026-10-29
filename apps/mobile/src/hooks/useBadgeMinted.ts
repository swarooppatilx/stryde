import { services } from '@repo/shared';
import { useCallback, useEffect, useState } from 'react';
import type { MintRead } from '@/utils/badgeState';
import { logger } from '@/utils/logger';

/** Whether a badge is already saved on chain (loading, failed or answered). Read-only: a second minter here could send the same badge twice. */
export function useBadgeMinted(id: string, address: `0x${string}` | null, enabled: boolean) {
  const [read, setRead] = useState<MintRead>('loading');
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt only re-runs the read
  useEffect(() => {
    if (!address || !enabled) return;
    let cancelled = false;
    setRead('loading');
    services.achievement
      .getMintedAchievementIds(address, [id])
      .then((ids) => {
        if (!cancelled) setRead(ids.has(id) ? 'minted' : 'notMinted');
      })
      .catch((error) => {
        logger.warn('[BadgeDetail] Could not read minted state', id, error);
        if (!cancelled) setRead('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [id, address, enabled, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { read, retry };
}
