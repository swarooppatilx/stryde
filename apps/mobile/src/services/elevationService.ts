import { logger } from '@/utils/logger';

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

/**
 * Vertical movement smaller than this is DEM/GPS noise: the ladder wiggles a few
 * metres between samples on flat ground, and summing every wobble inflates both
 * totals. Sums only re-arm once a move past the band confirms a real trend.
 */
const ELEVATION_DEADBAND_M = 3;

/** Ascent/descent over a ladder of elevations, ignoring chatter inside the deadband. */
export function climbAndDescent(elevations: readonly number[]): {
  ascent: number;
  descent: number;
} {
  let ascent = 0;
  let descent = 0;
  let reference = elevations[0] ?? 0;
  for (const elevation of elevations) {
    const drift = elevation - reference;
    if (Math.abs(drift) < ELEVATION_DEADBAND_M) continue;
    if (drift > 0) ascent += drift;
    else descent -= drift;
    reference = elevation;
  }
  return { ascent, descent };
}

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
  } catch (error) {
    logger.warn('[elevation] Lookup failed', error);
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

    const batchResults = await Promise.allSettled(batches.map((b) => fetchElevationBatch(b)));
    const elevations = batchResults.flatMap((result, i) => {
      if (result.status === 'fulfilled') return result.value;
      logger.warn('[Elevation] Batch failed:', result.reason);
      return new Array<null>(batches[i]?.length ?? 0).fill(null);
    });

    if (elevations.length === 0) return null;

    const validElevations = elevations.filter((e): e is number => e !== null);
    if (validElevations.length === 0) return null;

    const minElevation = Math.min(...validElevations);
    const maxElevation = Math.max(...validElevations);
    const { ascent, descent } = climbAndDescent(validElevations);

    return {
      elevations: validElevations,
      totalAscent: Math.round(ascent),
      totalDescent: Math.round(descent),
      minElevation: Math.round(minElevation),
      maxElevation: Math.round(maxElevation),
    };
  } catch (error) {
    logger.error('Failed to fetch elevation data:', error);
    return null;
  }
}
