import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { FEED_ORDERS, type FeedOrder } from '@/utils/feedView';
import { chainScopedStorageAdapter } from '@/utils/storage';

interface FeedPrefsState {
  /** How the Everyone feed is ordered: remembered between launches. */
  order: FeedOrder;
  setOrder: (order: FeedOrder) => void;
  /** Ids of the suggestion, club and challenge cards the athlete closed. */
  dismissedCards: string[];
  dismissCard: (id: string) => void;
  reset: () => void;
}

const DEFAULT_ORDER: FeedOrder = 'latest';
/** Closed cards are remembered, but only the newest so the list cannot grow without end. */
const MAX_DISMISSED = 200;

/** How the Home feed was left, so it opens the same way (this device only). */
export const useFeedPrefsStore = create<FeedPrefsState>()(
  persist(
    (set) => ({
      order: DEFAULT_ORDER,
      setOrder: (order) => set({ order }),
      dismissedCards: [],
      dismissCard: (id) =>
        set((s) =>
          s.dismissedCards.includes(id)
            ? s
            : { dismissedCards: [...s.dismissedCards, id].slice(-MAX_DISMISSED) }
        ),
      reset: () => set({ order: DEFAULT_ORDER, dismissedCards: [] }),
    }),
    {
      name: '@stryde/feed-prefs',
      version: 2,
      // Version 2 only added closed cards; `merge` below fills them in for version 1 state.
      migrate: (persisted) => persisted as FeedPrefsState,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
      // A value from storage that is no longer an order falls back to the default.
      merge: (persisted, current) => {
        const saved = persisted as Partial<FeedPrefsState> | undefined;
        const dismissed = Array.isArray(saved?.dismissedCards)
          ? saved.dismissedCards.filter((id) => typeof id === 'string')
          : [];
        return {
          ...current,
          order: FEED_ORDERS.find((o) => o === saved?.order) ?? DEFAULT_ORDER,
          dismissedCards: dismissed,
        };
      },
    }
  )
);
