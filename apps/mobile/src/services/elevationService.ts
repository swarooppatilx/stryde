const OPEN_METEO_ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';

export interface ElevationData {
  elevations: number[];
  totalAscent: number;
  totalDescent: number;
  minElevation: number;
  maxElevation: number;
}

const MAX_COORDINATES = 500;

export async function getElevationForRoute(
  coordinates: [number, number][]
): Promise<ElevationData | null> {
  if (coordinates.length === 0) return null;

  try {
    const sampled =
      coordinates.length > MAX_COORDINATES
        ? coordinates.filter((_, i) => i % Math.ceil(coordinates.length / MAX_COORDINATES) === 0)
        : coordinates;

    const lats = sampled.map((c) => c[1]).join(',');
    const lngs = sampled.map((c) => c[0]).join(',');

    const response = await fetch(`${OPEN_METEO_ELEVATION_URL}?latitude=${lats}&longitude=${lngs}`);

    if (!response.ok) return null;

    const data = await response.json();
    const elevations: number[] = data.elevation ?? [];

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
