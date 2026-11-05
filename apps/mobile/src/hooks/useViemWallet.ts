import { createContext, useContext } from 'react';
import type { WalletState } from './useWalletConnection';

export const WalletContext = createContext<WalletState | null>(null);

export function useViemWallet(): WalletState {
  const state = useContext(WalletContext);
  if (!state) throw new Error('useViemWallet must be used inside WalletProvider');
  return state;
}
