import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { asyncStorageAdapter, isoDateReviver } from '../utils/storage';

interface SettingsState {
  useGyroscopeAssist: boolean;
  sensorUpdateRate: 10 | 50;
  // Survives logout (unlike profileStore, which is cleared) so a returning
  // user who signs out lands on /login, not back through the full onboarding
  // carousel — that's only for people who have never authenticated before.
  hasOnboarded: boolean;
  setGyroscopeAssist: (enabled: boolean) => void;
  setSensorUpdateRate: (rate: 10 | 50) => void;
  setHasOnboarded: () => void;
  reset: () => void;
}

const INITIAL_STATE = {
  useGyroscopeAssist: true,
  sensorUpdateRate: 10 as const,
  hasOnboarded: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      setGyroscopeAssist: (enabled) => set({ useGyroscopeAssist: enabled }),
      setSensorUpdateRate: (rate) => set({ sensorUpdateRate: rate }),
      setHasOnboarded: () => set({ hasOnboarded: true }),
      reset: () => set(INITIAL_STATE),
    }),
    {
      name: '@stryde/settings',
      version: 1,
      storage: createJSONStorage(() => asyncStorageAdapter, { reviver: isoDateReviver }),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 1) return undefined;
        return persistedState;
      },
    }
  )
);
