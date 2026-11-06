import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getPlatform } from '@/platform';
import type { Gear, GearComponent, GearKind } from '@/types';
import { chainScopedStorageAdapter } from '@/utils/storage';

interface GearState {
  gear: Gear[];
  addGear: (input: { name: string; kind: GearKind; startingDistance?: number }) => Gear;
  retireGear: (id: string) => void;
  addComponent: (gearId: string, input: ComponentInput) => void;
  /** Starts the part's budget again from `now`, as after swapping in a new one. */
  replaceComponent: (gearId: string, componentId: string, now: number) => void;
  removeComponent: (gearId: string, componentId: string) => void;
  reset: () => void;
}

interface ComponentInput {
  name: string;
  installedAt: number;
  budgetDistance?: number;
  budgetTime?: number;
}

function mapComponents(
  gear: Gear[],
  gearId: string,
  fn: (components: GearComponent[]) => GearComponent[]
): Gear[] {
  return gear.map((g) => (g.id === gearId ? { ...g, components: fn(g.components ?? []) } : g));
}

export function migrateGearState(persisted: unknown, version: number): unknown {
  if (version < 2) {
    const state = (persisted ?? {}) as { gear?: Gear[] };
    return {
      ...state,
      gear: (state.gear ?? []).map((g) => ({ ...g, components: g.components ?? [] })),
    };
  }
  return persisted;
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
      addComponent: (gearId, input) => {
        const component: GearComponent = {
          id: getPlatform().ids.next(),
          name: input.name.trim(),
          installedAt: input.installedAt,
          budgetDistance: input.budgetDistance,
          budgetTime: input.budgetTime,
        };
        set((s) => ({ gear: mapComponents(s.gear, gearId, (c) => [...c, component]) }));
      },
      replaceComponent: (gearId, componentId, now) =>
        set((s) => ({
          gear: mapComponents(s.gear, gearId, (c) =>
            c.map((x) => (x.id === componentId ? { ...x, installedAt: now } : x))
          ),
        })),
      removeComponent: (gearId, componentId) =>
        set((s) => ({
          gear: mapComponents(s.gear, gearId, (c) => c.filter((x) => x.id !== componentId)),
        })),
      reset: () => set({ gear: [] }),
    }),
    {
      name: '@stryde/gear',
      version: 2,
      migrate: migrateGearState,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
    }
  )
);
