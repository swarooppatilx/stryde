import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { WeightEntry } from '@/utils/body';
import { chainScopedStorageAdapter } from '@/utils/storage';

/** About three years of daily weigh-ins; older ones drop off. */
export const MAX_WEIGHT_ENTRIES = 1100;

interface BodyState {
  /** Weight over time, oldest first, one per day. Kept on this device only. */
  entries: WeightEntry[];
  /** Saves a weigh-in for `day` (`YYYY-MM-DD`), replacing any earlier one for that day. */
  record: (day: string, kg: number) => void;
  reset: () => void;
}

export const useBodyStore = create<BodyState>()(
  persist(
    (set) => ({
      entries: [],
      record: (day, kg) =>
        set((state) => {
          const others = state.entries.filter((e) => e.day !== day);
          const next = [...others, { day, kg }].sort((a, b) => a.day.localeCompare(b.day));
          return { entries: next.slice(-MAX_WEIGHT_ENTRIES) };
        }),
      reset: () => set({ entries: [] }),
    }),
    {
      name: '@stryde/body',
      version: 1,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
    }
  )
);
