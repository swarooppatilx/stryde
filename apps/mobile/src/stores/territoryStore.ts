import { services } from '@repo/shared';
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
  // Who this chain-synced territory belongs to. `setTerritories()` is fed
  // straight from `syncTerritoriesFromChain(walletAddress)`, one wallet at a
  // time, so every entry in a given call shares this owner. Needed because
  // `territoryMetadata` is a flat, id-keyed map (not nested per-owner like
  // `polygons`), so without this `getTotalArea(owner)` couldn't tell whose
  // territory a given entry is.
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
      // Total territory area = chain-synced area (source of truth once a
      // territory is confirmed on-chain) + any locally-captured polygons that
      // haven't shown up in a chain sync yet (e.g. capture happened offline,
      // the claimTerritory tx is still pending, or sync hasn't run since).
      //
      // These two sets can overlap: `capturePolygon()` always records the
      // locally-drawn polygon before `claimTerritory()` even attempts the
      // on-chain claim (see create-activity.tsx), and `polygons[owner]` is
      // never cleared once that claim confirms. So the same physical
      // territory can legitimately live in both `polygons` and
      // `territoryMetadata` at once, and naively summing both would double
      // count it.
      //
      // The on-chain territory id IS the polygon hash (TerritoryRegistry
      // stores `_territories[polygonHash]` and returns that same value as
      // `Territory.polygonHash`/the id from `getUserTerritories`), computed
      // client-side by the identical `computePolygonHash()` used for both
      // capture and claim. So a local polygon whose hash matches a
      // `territoryMetadata` id is the same territory already counted via
      // chain data — skip it locally and prefer the on-chain areaSqm.
      getTotalArea: (owner) => {
        const state = get();
        const chainTerritories = Object.values(state.territoryMetadata).filter(
          (t) => t.owner === owner
        );
        const chainAreaSqm = chainTerritories.reduce((sum, t) => sum + t.areaSqm, 0);
        const chainHashes = new Set(chainTerritories.map((t) => t.id));

        const localOnlyAreaSqm = (state.polygons[owner] || []).reduce((sum, polygon) => {
          const hash = services.territory.computePolygonHash(polygon);
          if (chainHashes.has(hash)) return sum;
          return sum + territoryService.getPolygonArea(polygon);
        }, 0);

        return chainAreaSqm + localOnlyAreaSqm;
      },
      getTerritoryMetadata: (polygonHash) => get().territoryMetadata[polygonHash],
      setTerritories: (owner, territories) =>
        set((state) => ({
          territoryMetadata: {
            ...state.territoryMetadata,
            ...Object.fromEntries(territories.map((t) => [t.id, { ...t, owner }])),
          },
        })),
      reset: () => set({ polygons: {}, territoryMetadata: {} }),
    }),
    {
      name: '@stryde/territory-polygons',
      version: 2,
      storage: createJSONStorage(() => asyncStorageAdapter, { reviver: isoDateReviver }),
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
          // `owner` is new in v2 — entries persisted before this fix have no
          // owner recorded. Drop them rather than guess: the next chain sync
          // (which runs on every app start with a connected wallet) rewrites
          // them with `owner` set, so this is self-healing and momentary.
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
