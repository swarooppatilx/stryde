import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getPlatform } from '@/platform';
import type { Gear, GearKind } from '@/types';
import { chainScopedStorageAdapter } from '@/utils/storage';

interface GearState {
  gear: Gear[];
  addGear: (input: { name: string; kind: GearKind; startingDistance?: number }) => Gear;
  retireGear: (id: string) => void;
  reset: () => void;
}

export const useGearStore = create<GearState>()(
  persist(
    (set) => ({
      gear: [],
      addGear: ({ name, kind, startingDistance = 0 }) => {
        const gear: Gear = {
          id: getPlatform().ids.next(),
          name: name.trim(),
          kind,
          startingDistance,
        };
        set((s) => ({ gear: [...s.gear, gear] }));
        return gear;
      },
      retireGear: (id) =>
        set((s) => ({ gear: s.gear.map((g) => (g.id === id ? { ...g, retired: true } : g)) })),
      reset: () => set({ gear: [] }),
    }),
    {
      name: '@stryde/gear',
      version: 1,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
    }
  )
);
