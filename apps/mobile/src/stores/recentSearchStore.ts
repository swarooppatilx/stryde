import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { type RecentSearch, rememberSearch } from '@/utils/recentSearches';
import { chainScopedStorageAdapter } from '@/utils/storage';

interface RecentSearchState {
  recents: RecentSearch[];
  remember: (entry: RecentSearch) => void;
  forget: (entry: RecentSearch) => void;
  clear: () => void;
}

/** What the athlete opened from search, kept on this device only. */
export const useRecentSearchStore = create<RecentSearchState>()(
  persist(
    (set) => ({
      recents: [],
      remember: (entry) => set((s) => ({ recents: rememberSearch(s.recents, entry) })),
      forget: (entry) =>
        set((s) => ({
          recents: s.recents.filter((r) => !(r.kind === entry.kind && r.id === entry.id)),
        })),
      clear: () => set({ recents: [] }),
    }),
    {
      name: '@stryde/recent-searches',
      version: 1,
      migrate: (persisted) => persisted,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
    }
  )
);
