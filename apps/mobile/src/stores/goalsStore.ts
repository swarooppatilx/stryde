import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getPlatform } from '@/platform';
import { type Goal, seedGoals } from '@/utils/goals';
import { chainScopedStorageAdapter } from '@/utils/storage';

interface GoalsState {
  goals: Goal[];
  /** The weekly goals from before this list existed have been read in. */
  seeded: boolean;
  /** The athlete has made, changed or removed a goal themselves. */
  touched: boolean;
  /** Reads the old weekly goals in as the first goals, once; later calls do nothing. */
  seed: (weekly: { distance: number; activities: number; time: number }) => void;
  addGoal: (input: Omit<Goal, 'id'>) => Goal;
  updateGoal: (id: string, patch: Partial<Omit<Goal, 'id'>>) => void;
  removeGoal: (id: string) => void;
  reset: () => void;
}

const INITIAL = { goals: [] as Goal[], seeded: false, touched: false };

export const useGoalsStore = create<GoalsState>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      seed: (weekly) => {
        if (get().seeded) return;
        const ids = getPlatform().ids;
        set((s) => ({
          seeded: true,
          goals: [...s.goals, ...seedGoals(weekly).map((g) => ({ ...g, id: ids.next() }))],
        }));
      },
      addGoal: (input) => {
        const goal: Goal = { ...input, id: getPlatform().ids.next() };
        set((s) => ({ goals: [...s.goals, goal], seeded: true, touched: true }));
        return goal;
      },
      updateGoal: (id, patch) =>
        set((s) => ({
          goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
          touched: true,
        })),
      removeGoal: (id) =>
        set((s) => ({ goals: s.goals.filter((g) => g.id !== id), seeded: true, touched: true })),
      reset: () => set(INITIAL),
    }),
    {
      name: '@stryde/goals',
      version: 1,
      migrate: (persisted) => persisted,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
      partialize: (s) => ({ goals: s.goals, seeded: s.seeded, touched: s.touched }),
    }
  )
);
