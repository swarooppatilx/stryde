import { useMemo } from 'react';
import { hiddenAuthors, useBlockStore } from '@/stores/blockStore';

/** Lower-case wallets of everyone the athlete blocked or muted; stable until that list changes. */
export function useHiddenAuthors(): ReadonlySet<string> {
  const blocked = useBlockStore((s) => s.blocked);
  const muted = useBlockStore((s) => s.muted);
  return useMemo(() => hiddenAuthors(blocked, muted), [blocked, muted]);
}
