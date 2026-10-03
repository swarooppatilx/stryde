import { services } from '@repo/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { territoryService } from '@/services/territoryService';
import type { Ring } from '@/types';
import { chainScopedStorageAdapter, isoDateReviver } from '@/utils/storage';

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
  // Owner of this chain-synced territory. `territoryMetadata` is a flat id-keyed map, so without it
  // `getTotalArea(owner)` could not tell whose entry this is.
  owner: string;
}

interface TerritoryState {
  polygons: Record<string, Ring[]>;
  territoryMetadata: Record<string, TerritoryMetadata>;
  capturePolygon: (owner: string, polygon: Ring) => void;
  getUserPolygons: (owner: string) => Ring[];
  getTotalArea: (owner: string) => number;
  getTerritoryMetadata: (polygonHash: string) => TerritoryMetadata | undefined;
  setTerritories: (owner: string, territories: Array<Omit<TerritoryMetadata, 'owner'>>) => void;
  reset: () => void;
}

type TerritoryData = Pick<TerritoryState, 'polygons' | 'territoryMetadata'>;

/** Polygons captured on this device for `owner`. */
export function userPolygons(state: Pick<TerritoryData, 'polygons'>, owner: string): Ring[] {
  return state.polygons[owner] || EMPTY_POLYGONS;
}

/**
 * Chain-synced area plus locally captured polygons the chain doesn't have yet. A territory
 * can be in both (captured, then claimed): the onchain id is the polygon hash, so a local
 * polygon whose hash is already synced is counted once, from the chain.
 */
export function totalTerritoryArea(state: TerritoryData, owner: string): number {
  const chainTerritories = Object.values(state.territoryMetadata).filter((t) => t.owner === owner);
  const chainAreaSqm = chainTerritories.reduce((sum, t) => sum + t.areaSqm, 0);
  const chainHashes = new Set(chainTerritories.map((t) => t.id));

  const localOnlyAreaSqm = (state.polygons[owner] || []).reduce((sum, polygon) => {
    const hash = services.territory.computePolygonHash(polygon);
    if (chainHashes.has(hash)) return sum;
    return sum + territoryService.getPolygonArea(polygon);
  }, 0);

  return chainAreaSqm + localOnlyAreaSqm;
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
            const pFirst = p[0];
            if (p.length !== polygon.length || !pFirst || !firstPoint) return false;
            const pArea = territoryService.getPolygonArea(p);
            return (
              Math.abs(pFirst[0] - firstPoint[0]) < DUPLICATE_COORD_TOLERANCE_DEG &&
              Math.abs(pFirst[1] - firstPoint[1]) < DUPLICATE_COORD_TOLERANCE_DEG &&
              Math.abs(pArea - area) < DUPLICATE_AREA_TOLERANCE_SQM
            );
          });
          if (isDuplicate) return state;
          return { polygons: { ...state.polygons, [owner]: [...existing, polygon] } };
        }),
      getUserPolygons: (owner) => userPolygons(get(), owner),
      getTotalArea: (owner) => totalTerritoryArea(get(), owner),
      getTerritoryMetadata: (polygonHash) => get().territoryMetadata[polygonHash],
      // Replaces the owner's synced set: a territory the chain no longer reports (decayed, lost) must stop counting.
      setTerritories: (owner, territories) =>
        set((state) => ({
          territoryMetadata: {
            ...Object.fromEntries(
              Object.entries(state.territoryMetadata).filter(([, t]) => t.owner !== owner)
            ),
            ...Object.fromEntries(territories.map((t) => [t.id, { ...t, owner }])),
          },
        })),
      reset: () => set({ polygons: {}, territoryMetadata: {} }),
    }),
    {
      name: '@stryde/territory-polygons',
      version: 2,
      storage: createJSONStorage(() => chainScopedStorageAdapter, { reviver: isoDateReviver }),
      partialize: (state) => ({
        polygons: state.polygons,
        territoryMetadata: state.territoryMetadata,
      }),
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 1) {
          state.polygons = state.polygons ?? {};
          state.territoryMetadata = state.territoryMetadata ?? {};
        }
        if (version < 2) {
          // Entries persisted before `owner` existed have none. Drop them: the next chain sync
          // (every app start with a connected wallet) rewrites them with it.
          const oldMetadata = (state.territoryMetadata ?? {}) as Record<string, unknown>;
          state.territoryMetadata = Object.fromEntries(
            Object.entries(oldMetadata).filter(
              ([, t]) => typeof (t as { owner?: unknown }).owner === 'string'
            )
          );
        }
        return state;
      },
    }
  )
);
