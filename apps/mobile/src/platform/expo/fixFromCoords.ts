import type { Location } from '@/types';

interface Coords {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  altitude?: number | null;
  heading?: number | null;
  altitudeAccuracy?: number | null;
}

/** A known, non-negative reading. The platform reports "unknown" as null or a negative number. */
const known = (value: number | null | undefined): number | undefined =>
  value !== null && value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined;

/** One fix from the platform's coordinates, keeping everything the GPS chip reported. */
export function fixFromCoords(coords: Coords, timestamp: number, mocked?: boolean): Location {
  const speed = known(coords.speed);
  const bearing = known(coords.heading);
  const verticalAccuracy = known(coords.altitudeAccuracy);
  const altitude =
    coords.altitude !== null && coords.altitude !== undefined && Number.isFinite(coords.altitude)
      ? coords.altitude
      : undefined;
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    timestamp,
    accuracy: coords.accuracy ?? 0,
    ...(speed !== undefined && { speed }),
    ...(altitude !== undefined && { altitude }),
    ...(bearing !== undefined && { bearing }),
    ...(verticalAccuracy !== undefined && { verticalAccuracy }),
    ...(mocked && { mocked: true }),
  };
}
