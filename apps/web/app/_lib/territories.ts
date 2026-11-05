import { querySubgraph, shortAddress, subgraphUrl } from './subgraph';

export interface TerritoryRow {
  id: string;
  area: string; // m²
  // Degrees x 1e6, as the TerritoryRegistry stores them.
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  owner: { id: string; username: string };
}

export interface TerritoryFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: { id: string; area: number; owner: string };
    geometry: { type: 'Polygon'; coordinates: Array<Array<[number, number]>> };
  }>;
}

const FIXED_POINT = 1e6;

/** Each active territory's footprint as a rectangle (the subgraph keeps its bounds, not its outline). */
export function toFeatureCollection(rows: readonly TerritoryRow[]): TerritoryFeatureCollection {
  const features = rows
    .filter((r) => r.minLng !== 0 || r.minLat !== 0 || r.maxLng !== 0 || r.maxLat !== 0)
    .map((r) => {
      const [west, south, east, north] = [r.minLng, r.minLat, r.maxLng, r.maxLat].map(
        (v) => v / FIXED_POINT
      ) as [number, number, number, number];
      return {
        type: 'Feature' as const,
        properties: {
          id: r.id,
          area: Number(r.area),
          owner: r.owner.username || shortAddress(r.owner.id),
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ] as Array<[number, number]>,
          ],
        },
      };
    });
  return { type: 'FeatureCollection', features };
}

/** Every active territory from the subgraph; null when it can't be reached. */
export async function fetchTerritories(
  url = subgraphUrl()
): Promise<TerritoryFeatureCollection | null> {
  try {
    const { territories } = await querySubgraph<{ territories: TerritoryRow[] }>(
      url,
      `{ territories(first: 1000, where: { isActive: true }) {
        id area minLng minLat maxLng maxLat owner { id username }
      } }`
    );
    return toFeatureCollection(territories);
  } catch {
    return null;
  }
}
