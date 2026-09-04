import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { IActivityService } from '../types/services';
import { asyncStorageAdapter, isoDateReviver } from '../utils/storage';

interface ActivityState extends IActivityService {}

export const useActivityStore = create<ActivityState>()(
  persist(
    (set, get) => ({
      activities: [],
      saveActivity: (activity) =>
        set((state) => {
          if (state.activities.some((a) => a.id === activity.id)) return state;
          return { activities: [activity, ...state.activities] };
        }),
      deleteActivity: (id) =>
        set((state) => ({
          activities: state.activities.filter((a) => a.id !== id),
        })),
      updateActivity: (id, updates) =>
        set((state) => ({
          activities: state.activities.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),
      getActivityById: (id) => get().activities.find((a) => a.id === id),
      reset: () => set({ activities: [] }),
    }),
    {
      name: '@onchainstrava/activities',
      storage: createJSONStorage(() => asyncStorageAdapter, { reviver: isoDateReviver }),
    }
  )
);
