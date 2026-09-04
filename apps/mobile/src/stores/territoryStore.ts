import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { territoryService } from '@/services/territoryService';
import type { Ring } from '@/types';
import { asyncStorageAdapter, isoDateReviver } from '../utils/storage';

interface TerritoryState {
  polygons: Record<string, Ring[]>;
  capturePolygon: (owner: string, polygon: Ring) => void;
  getUserPolygons: (owner: string) => Ring[];
  getTotalArea: (owner: string) => number;
  reset: () => void;
}

export const useTerritoryStore = create<TerritoryState>()(
  persist(
    (set, get) => ({
      polygons: {},
      capturePolygon: (owner, polygon) =>
        set((state) => {
          const existing = state.polygons[owner] || [];
          return { polygons: { ...state.polygons, [owner]: [...existing, polygon] } };
        }),
      getUserPolygons: (owner) => get().polygons[owner] || [],
      getTotalArea: (owner) =>
        (get().polygons[owner] || []).reduce(
          (sum, polygon) => sum + territoryService.getPolygonArea(polygon),
          0
        ),
      reset: () => set({ polygons: {} }),
    }),
    {
      name: '@onchainstrava/territory-polygons',
      storage: createJSONStorage(() => asyncStorageAdapter, { reviver: isoDateReviver }),
    }
  )
);
