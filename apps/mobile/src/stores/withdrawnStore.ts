import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { chainScopedStorageAdapter } from '@/utils/storage';

interface WithdrawnState {
  /** Challenge ids the athlete has already withdrawn or reclaimed from. */
  ids: string[];
  markWithdrawn: (challengeId: string) => void;
  reset: () => void;
}

/** So reopening a challenge does not offer to withdraw again what was already taken out (this device only). */
export const useWithdrawnStore = create<WithdrawnState>()(
  persist(
    (set) => ({
      ids: [],
      markWithdrawn: (challengeId) =>
        set((s) => (s.ids.includes(challengeId) ? s : { ids: [...s.ids, challengeId] })),
      reset: () => set({ ids: [] }),
    }),
    {
      name: '@stryde/withdrawn-challenges',
      version: 1,
      migrate: (persisted) => persisted,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
    }
  )
);
