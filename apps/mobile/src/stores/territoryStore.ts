import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { territoryService } from '@/services/territoryService';
import type { Ring } from '@/types';
import { asyncStorageAdapter, isoDateReviver } from '../utils/storage';

const DUPLICATE_COORD_TOLERANCE_DEG = 0.0001;
const DUPLICATE_AREA_TOLERANCE_SQM = 1;

// Stable reference so callers using this as a Zustand selector value don't
// re-render on every read just because `[]` !== `[]`.
const EMPTY_POLYGONS: Ring[] = [];

interface TerritoryMetadata {
  id: string;
  areaSqm: number;
  strength: number;
  capturedAt: number;
  lastReinforced: number;
}

interface TerritoryState {
  polygons: Record<string, Ring[]>;
  territoryMetadata: Record<string, TerritoryMetadata>;
  capturePolygon: (owner: string, polygon: Ring) => void;
  getUserPolygons: (owner: string) => Ring[];
  getTotalArea: (owner: string) => number;
  getTerritoryMetadata: (polygonHash: string) => TerritoryMetadata | undefined;
  setTerritories: (owner: string, territories: TerritoryMetadata[]) => void;
  reset: () => void;
}

export const useTerritoryStore = create<TerritoryState>()(
  persist(
    (set, get) => ({
      polygons: {},
      territoryMetadata: {},
      capturePolygon: (owner, polygon) =>
        set((state) => {
          const existing = state.polygons[owner] || [];
          const area = territoryService.getPolygonArea(polygon);
          const firstPoint = polygon[0];
          const isDuplicate = existing.some((p) => {
            if (p.length !== polygon.length) return false;
            const pArea = territoryService.getPolygonArea(p);
            return (
              Math.abs(p[0][0] - firstPoint[0]) < DUPLICATE_COORD_TOLERANCE_DEG &&
              Math.abs(p[0][1] - firstPoint[1]) < DUPLICATE_COORD_TOLERANCE_DEG &&
              Math.abs(pArea - area) < DUPLICATE_AREA_TOLERANCE_SQM
            );
          });
          if (isDuplicate) return state;
          return { polygons: { ...state.polygons, [owner]: [...existing, polygon] } };
        }),
      getUserPolygons: (owner) => get().polygons[owner] || EMPTY_POLYGONS,
      getTotalArea: (owner) =>
        (get().polygons[owner] || []).reduce(
          (sum, polygon) => sum + territoryService.getPolygonArea(polygon),
          0
        ),
      getTerritoryMetadata: (polygonHash) => get().territoryMetadata[polygonHash],
      setTerritories: (_owner, territories) =>
        set((state) => ({
          territoryMetadata: {
            ...state.territoryMetadata,
            ...Object.fromEntries(territories.map((t) => [t.id, t])),
          },
        })),
      reset: () => set({ polygons: {}, territoryMetadata: {} }),
    }),
    {
      name: '@stryde/territory-polygons',
      version: 1,
      storage: createJSONStorage(() => asyncStorageAdapter, { reviver: isoDateReviver }),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 1) {
          return undefined;
        }
        return persistedState;
      },
    }
  )
);
