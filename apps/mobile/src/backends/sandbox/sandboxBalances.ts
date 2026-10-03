import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BalanceReader } from '@/backends/balanceSource';
import { chainScopedStorageAdapter } from '@/utils/storage';

/** What a fresh Sandbox athlete holds: enough that the profile and Account show real-looking amounts. */
export const SANDBOX_START_ETH_WEI = 12n * 10n ** 17n; // 1.2 ETH
export const SANDBOX_START_STRD_WEI = 15n * 10n ** 18n; // 15 STRD

interface SandboxBalancesState {
  /** Wei as decimal strings: persisted JSON cannot hold a bigint. */
  eth: string;
  strd: string;
  addStrd: (wei: bigint) => void;
  reset: () => void;
}

const START = {
  eth: SANDBOX_START_ETH_WEI.toString(),
  strd: SANDBOX_START_STRD_WEI.toString(),
} as const;

/** The Sandbox has no chain to read balances from, so it keeps its own, growing as rewards are minted. */
export const useSandboxBalances = create<SandboxBalancesState>()(
  persist(
    (set) => ({
      ...START,
      addStrd: (wei) => set((s) => ({ strd: (BigInt(s.strd) + wei).toString() })),
      reset: () => set({ ...START }),
    }),
    {
      name: '@stryde/sandbox-balances',
      version: 1,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
    }
  )
);

/** The Sandbox's source for the profile and Account screens: the same two figures for every address. */
export const sandboxBalanceReader: BalanceReader = async () => {
  const { eth, strd } = useSandboxBalances.getState();
  return { eth: BigInt(eth), strd: BigInt(strd) };
};
