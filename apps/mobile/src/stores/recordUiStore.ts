import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { chainScopedStorageAdapter } from '@/utils/storage';

interface RecordUiState {
  /** Whether the Record screen offers the Lap button. */
  trackLaps: boolean;
  setTrackLaps: (on: boolean) => void;
  reset: () => void;
}

const DEFAULTS = { trackLaps: true } as const;

/** How the athlete left the Record screen's own options (this device only). */
export const useRecordUiStore = create<RecordUiState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setTrackLaps: (trackLaps) => set({ trackLaps }),
      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: '@stryde/record-ui',
      version: 1,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
    }
  )
);
