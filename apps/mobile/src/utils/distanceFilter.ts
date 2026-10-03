import { haversineDistance } from '@/utils/geo';

export type DistanceFilter = 'any' | 'short' | 'medium' | 'long';

/** Where the bands split, in metres. */
export const SHORT_MAX = 5000;
export const MEDIUM_MAX = 15_000;

export function inDistanceBand(filter: DistanceFilter, meters: number): boolean {
  switch (filter) {
    case 'any':
      return true;
    case 'short':
      return meters < SHORT_MAX;
    case 'medium':
      return meters >= SHORT_MAX && meters < MEDIUM_MAX;
    case 'long':
      return meters >= MEDIUM_MAX;
  }
}

export function routeLength(coordinates: readonly (readonly [number, number])[]): number {
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1];
    const b = coordinates[i];
    if (a && b) total += haversineDistance(a[1], a[0], b[1], b[0]);
  }
  return total;
}
