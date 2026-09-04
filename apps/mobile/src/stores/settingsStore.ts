import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { asyncStorageAdapter } from '../utils/storage';

interface SettingsState {
  useGyroscopeAssist: boolean;
  sensorUpdateRate: 10 | 50;
  setGyroscopeAssist: (enabled: boolean) => void;
  setSensorUpdateRate: (rate: 10 | 50) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      useGyroscopeAssist: true,
      sensorUpdateRate: 10,
      setGyroscopeAssist: (enabled) => set({ useGyroscopeAssist: enabled }),
      setSensorUpdateRate: (rate) => set({ sensorUpdateRate: rate }),
    }),
    {
      name: '@onchainstrava/settings',
      storage: createJSONStorage(() => asyncStorageAdapter),
    }
  )
);
