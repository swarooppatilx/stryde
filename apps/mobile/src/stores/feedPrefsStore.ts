import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { FEED_ORDERS, type FeedOrder } from '@/utils/feedView';
import { chainScopedStorageAdapter } from '@/utils/storage';

interface FeedPrefsState {
  /** How the Everyone feed is ordered: remembered between launches. */
  order: FeedOrder;
  setOrder: (order: FeedOrder) => void;
  reset: () => void;
}

const DEFAULT_ORDER: FeedOrder = 'latest';

/** How the Home feed was left, so it opens the same way (this device only). */
export const useFeedPrefsStore = create<FeedPrefsState>()(
  persist(
    (set) => ({
      order: DEFAULT_ORDER,
      setOrder: (order) => set({ order }),
      reset: () => set({ order: DEFAULT_ORDER }),
    }),
    {
      name: '@stryde/feed-prefs',
      version: 1,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
      // A value from storage that is no longer an order falls back to the default.
      merge: (persisted, current) => {
        const order = (persisted as Partial<FeedPrefsState> | undefined)?.order;
        return {
          ...current,
          order: FEED_ORDERS.find((o) => o === order) ?? DEFAULT_ORDER,
        };
      },
    }
  )
);
