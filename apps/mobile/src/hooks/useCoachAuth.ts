import { useMemo } from 'react';
import { useViemWallet } from '@/hooks/useViemWallet';
import type { HumanAuth } from '@/services/humanPassService';

/** The wallet that signs the coach session, or null until one is connected. */
export function useCoachAuth(): HumanAuth | null {
  const { wallet, address } = useViemWallet();
  return useMemo(() => (wallet && address ? { wallet, address } : null), [wallet, address]);
}
