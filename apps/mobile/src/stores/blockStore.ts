import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  NOTHING_REPORTED,
  type ReportedHidden,
  type ReportTarget,
  withReportedHidden,
} from '@/utils/reporting';
import { chainScopedStorageAdapter } from '@/utils/storage';

interface BlockState {
  /** Lower-case wallets whose activities, posts and profile the athlete does not want to see. */
  blocked: string[];
  /** Lower-case wallets hidden from feeds only. */
  muted: string[];
  /** Activities and comments the athlete reported, hidden by id. A reported user is muted instead. */
  reportedHidden: ReportedHidden;
  /** Activities the athlete chose to hide from Home. Not a report: the author is not muted and nothing is sent. */
  hiddenFromHome: string[];
  block: (address: string) => void;
  unblock: (address: string) => void;
  mute: (address: string) => void;
  unmute: (address: string) => void;
  /** Hides a reported item right away on this device. */
  hideReported: (target: ReportTarget) => void;
  hideFromHome: (activityId: string) => void;
  showOnHome: (activityId: string) => void;
  reset: () => void;
}

const added = (list: string[], address: string) => {
  const key = address.toLowerCase();
  return list.includes(key) ? list : [...list, key];
};
const removed = (list: string[], address: string) =>
  list.filter((a) => a !== address.toLowerCase());

/** Who the athlete has blocked or muted, kept on this device only. */
export const useBlockStore = create<BlockState>()(
  persist(
    (set) => ({
      blocked: [],
      muted: [],
      reportedHidden: NOTHING_REPORTED,
      hiddenFromHome: [],
      block: (address) => set((s) => ({ blocked: added(s.blocked, address) })),
      unblock: (address) => set((s) => ({ blocked: removed(s.blocked, address) })),
      mute: (address) => set((s) => ({ muted: added(s.muted, address) })),
      unmute: (address) => set((s) => ({ muted: removed(s.muted, address) })),
      hideReported: (target) =>
        set((s) =>
          target.kind === 'user'
            ? { muted: added(s.muted, target.id) }
            : { reportedHidden: withReportedHidden(s.reportedHidden, target) }
        ),
      hideFromHome: (activityId) =>
        set((s) =>
          s.hiddenFromHome.includes(activityId)
            ? s
            : { hiddenFromHome: [...s.hiddenFromHome, activityId] }
        ),
      showOnHome: (activityId) =>
        set((s) => ({ hiddenFromHome: s.hiddenFromHome.filter((id) => id !== activityId) })),
      reset: () =>
        set({ blocked: [], muted: [], reportedHidden: NOTHING_REPORTED, hiddenFromHome: [] }),
    }),
    {
      name: '@stryde/blocked',
      version: 1,
      migrate: (persisted) => persisted,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
    }
  )
);

/** Everyone to leave out of feeds and search: blocked and muted athletes. */
export function hiddenAuthors(blocked: readonly string[], muted: readonly string[]) {
  return new Set([...blocked, ...muted]);
}
