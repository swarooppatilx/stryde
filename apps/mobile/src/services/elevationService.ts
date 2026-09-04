const OPEN_METEO_ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';

export interface ElevationData {
  elevations: number[];
  totalAscent: number;
  totalDescent: number;
  minElevation: number;
  maxElevation: number;
}

const BATCH_SIZE = 100;
const FETCH_TIMEOUT_MS = 10_000;

async function fetchElevationBatch(coordinates: [number, number][]): Promise<number[]> {
  const lats = coordinates.map((c) => c[1]).join(',');
  const lngs = coordinates.map((c) => c[0]).join(',');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${OPEN_METEO_ELEVATION_URL}?latitude=${lats}&longitude=${lngs}`, {
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.elevation ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function getElevationForRoute(
  coordinates: [number, number][]
): Promise<ElevationData | null> {
  if (coordinates.length === 0) return null;

  try {
    const sampled =
      coordinates.length > BATCH_SIZE * 5
        ? coordinates.filter((_, i) => i % Math.ceil(coordinates.length / (BATCH_SIZE * 5)) === 0)
        : coordinates;

    const batches: [number, number][][] = [];
    for (let i = 0; i < sampled.length; i += BATCH_SIZE) {
      batches.push(sampled.slice(i, i + BATCH_SIZE));
    }

    const elevations: number[] = [];
    for (const batch of batches) {
      const batchElevations = await fetchElevationBatch(batch);
      elevations.push(...batchElevations);
    }

    if (elevations.length === 0) return null;

    let totalAscent = 0;
    let totalDescent = 0;
    let minElevation = elevations[0];
    let maxElevation = elevations[0];

    for (let i = 1; i < elevations.length; i++) {
      const diff = elevations[i] - elevations[i - 1];
      if (diff > 0) {
        totalAscent += diff;
      } else {
        totalDescent += Math.abs(diff);
      }
      minElevation = Math.min(minElevation, elevations[i]);
      maxElevation = Math.max(maxElevation, elevations[i]);
    }

    return {
      elevations,
      totalAscent: Math.round(totalAscent),
      totalDescent: Math.round(totalDescent),
      minElevation: Math.round(minElevation),
      maxElevation: Math.round(maxElevation),
    };
  } catch (error) {
    console.error('Failed to fetch elevation data:', error);
    return null;
  }
}
