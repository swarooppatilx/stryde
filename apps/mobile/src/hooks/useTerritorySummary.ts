import { totalTerritoryArea, userPolygons, useTerritoryStore } from '@/stores/territoryStore';

/** An athlete's captured polygons and total area; updates when a capture or a chain sync lands. */
export function useTerritorySummary(owner: string) {
  const polygons = useTerritoryStore((s) => s.polygons);
  const territoryMetadata = useTerritoryStore((s) => s.territoryMetadata);
  return {
    polygons: userPolygons({ polygons }, owner),
    totalArea: totalTerritoryArea({ polygons, territoryMetadata }, owner),
  };
}
