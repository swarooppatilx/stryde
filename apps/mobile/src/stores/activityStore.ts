import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { usePushPrimerStore } from '@/stores/pushPrimerStore';
import type { IActivityService } from '@/types/services';
import { chainScopedStorageAdapter, isoDateReviver } from '@/utils/storage';

interface ActivityState extends IActivityService {
  /** Lowercase hashes of activities deleted here; onchain records can't be erased, so chain sync must not bring them back. */
  deletedHashes: string[];
  setActivities: (activities: import('@/types').Activity[]) => void;
}

export const useActivityStore = create<ActivityState>()(
  persist(
    (set, get) => ({
      activities: [],
      deletedHashes: [],
      saveActivity: (activity) => {
        set((state) => {
          if (state.activities.some((a) => a.id === activity.id)) return state;
          return { activities: [activity, ...state.activities] };
        });
        usePushPrimerStore.getState().noteMoment();
      },
      deleteActivity: (id) =>
        set((state) => {
          const hash = state.activities.find((a) => a.id === id)?.activityHash?.toLowerCase();
          return {
            activities: state.activities.filter((a) => a.id !== id),
            deletedHashes:
              hash && !state.deletedHashes.includes(hash)
                ? [...state.deletedHashes, hash]
                : state.deletedHashes,
          };
        }),
      updateActivity: (id, updates) =>
        set((state) => ({
          activities: state.activities.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),
      getActivityById: (id) => get().activities.find((a) => a.id === id),
      reset: () => set({ activities: [], deletedHashes: [] }),
      setActivities: (activities) => set({ activities }),
    }),
    {
      name: '@stryde/activities',
      version: 1,
      storage: createJSONStorage(() => chainScopedStorageAdapter, { reviver: isoDateReviver }),
      partialize: (state) => ({
        activities: state.activities,
        deletedHashes: state.deletedHashes,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 1) {
          const state = persistedState as Record<string, unknown>;
          return { ...state, activities: state.activities ?? [] };
        }
        return persistedState;
      },
    }
  )
);
