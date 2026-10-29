import type { ReactNode } from 'react';
import { getChainMode } from '@/constants/config';
import { WalletContext } from '@/hooks/useViemWallet';
import { useWalletConnection } from '@/hooks/useWalletConnection';

export function WalletProvider({ children }: { children: ReactNode }) {
  const state = useWalletConnection(getChainMode());
  return <WalletContext.Provider value={state}>{children}</WalletContext.Provider>;
}
