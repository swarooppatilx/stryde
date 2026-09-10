import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { asyncStorageAdapter } from '@/utils/storage';

interface WorldVerificationState {
  isVerified: boolean;
  verifiedAt: number | null;
  nullifier: string | null;
  setVerified: (nullifier: string) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  isVerified: false,
  verifiedAt: null as number | null,
  nullifier: null as string | null,
};

export const useWorldVerificationStore = create<WorldVerificationState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      setVerified: (nullifier) =>
        set({
          isVerified: true,
          verifiedAt: Date.now(),
          nullifier,
        }),
      reset: () => set(INITIAL_STATE),
    }),
    {
      name: '@stryde/world-verification',
      version: 1,
      storage: createJSONStorage(() => asyncStorageAdapter),
    }
  )
);
