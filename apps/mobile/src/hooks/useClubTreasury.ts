import { services } from '@repo/shared';
import { useCallback, useRef, useState } from 'react';
import { logger } from '@/utils/logger';

/** A club's treasury balance, keyed by club id so a stale response is never applied after navigation; `refresh` changes only with the id. */
export function useClubTreasury(clubId: string | undefined) {
  const [read, setRead] = useState<{ clubId: string; balance: bigint } | null>(null);
  const current = useRef(clubId);
  current.current = clubId;

  const refresh = useCallback(() => {
    if (!clubId) return;
    services.group
      .getGroupTreasury(BigInt(clubId))
      .then((balance) => {
        if (current.current === clubId) setRead({ clubId, balance });
      })
      .catch((e) => logger.warn('[ClubTreasury] Failed to fetch balance:', e));
  }, [clubId]);

  return { balance: read && read.clubId === clubId ? read.balance : null, refresh };
}
