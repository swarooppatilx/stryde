import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { asyncStorageAdapter, isoDateReviver } from '../utils/storage';

export type AccuracyMode = 'best' | 'balanced' | 'power';

export const ACCURACY_MODES: AccuracyMode[] = ['best', 'balanced', 'power'];

/** Per-mode location sampling contract used by the tracking screen. */
export const ACCURACY_MODE_CONFIG: Record<
  AccuracyMode,
  { label: string; caption: string; timeInterval: number }
> = {
  best: {
    label: 'Best',
    caption: 'Highest fidelity, uses the most battery',
    timeInterval: 1000,
  },
  balanced: {
    label: 'Balanced',
    caption: 'Good accuracy with moderate battery drain',
    timeInterval: 3000,
  },
  power: {
    label: 'Low-power',
    caption: 'Coarse fixes that maximize battery life',
    timeInterval: 5000,
  },
};

interface SettingsState {
  useGyroscopeAssist: boolean;
  sensorUpdateRate: 10 | 50;
  autoPause: boolean;
  /** Trade-off between GPS fix quality and battery life while tracking. */
  accuracyMode: AccuracyMode;
  // Survives logout (unlike profileStore, which is cleared) so a returning
  // user who signs out lands on /login, not back through the full onboarding
  // carousel — that's only for people who have never authenticated before.
  hasOnboarded: boolean;
  setGyroscopeAssist: (enabled: boolean) => void;
  setSensorUpdateRate: (rate: 10 | 50) => void;
  setAutoPause: (enabled: boolean) => void;
  setAccuracyMode: (mode: AccuracyMode) => void;
  setHasOnboarded: () => void;
  reset: () => void;
}

const INITIAL_STATE = {
  useGyroscopeAssist: true,
  sensorUpdateRate: 10 as const,
  hasOnboarded: false,
  autoPause: true,
  accuracyMode: 'balanced' as AccuracyMode,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      setGyroscopeAssist: (enabled) => set({ useGyroscopeAssist: enabled }),
      setSensorUpdateRate: (rate) => set({ sensorUpdateRate: rate }),
      setAutoPause: (enabled) => set({ autoPause: enabled }),
      setAccuracyMode: (mode) => set({ accuracyMode: mode }),
      setHasOnboarded: () => set({ hasOnboarded: true }),
      reset: () => set(INITIAL_STATE),
    }),
    {
      name: '@stryde/settings',
      version: 3,
      storage: createJSONStorage(() => asyncStorageAdapter, { reviver: isoDateReviver }),
      migrate: (persistedState: unknown, version: number) => {
        let state = persistedState as Record<string, unknown>;
        if (version < 1) {
          state = {
            ...state,
            useGyroscopeAssist: state.useGyroscopeAssist ?? true,
            sensorUpdateRate: state.sensorUpdateRate ?? 10,
          };
        }
        if (version < 2) {
          state = { ...state, autoPause: true };
        }
        if (version < 3) {
          state = { ...state, accuracyMode: 'balanced' };
        }
        return state;
      },
    }
  )
);
