import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { asyncStorageAdapter } from '@/utils/storage';

/** `idle`: not yet offered. `due`: the moment came, the sheet should show. `answered`: never offered again. */
export type PrimerStatus = 'idle' | 'due' | 'answered';

interface PushPrimerState {
  status: PrimerStatus;
  /** The first saved activity or first follow happened: offer the sheet, once. */
  noteMoment: () => void;
  /** Allow or Not now: either way the question has been put. */
  answer: () => void;
}

/** Whether the notifications primer has been offered. Device-wide, not per account: it asks about this phone. */
export const usePushPrimerStore = create<PushPrimerState>()(
  persist(
    (set) => ({
      status: 'idle',
      noteMoment: () => set((s) => (s.status === 'idle' ? { status: 'due' } : s)),
      answer: () => set({ status: 'answered' }),
    }),
    {
      name: '@stryde/push-primer',
      version: 1,
      storage: createJSONStorage(() => asyncStorageAdapter),
    }
  )
);
