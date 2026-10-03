import { pointsAtFractions } from './colorSegments';
import type { LngLatPair } from './mapData';

export interface SplitMarker {
  coordinate: LngLatPair;
  /** The split that ends here: "1" at the end of the first kilometre (or mile). */
  label: string;
}

/** Distance sums drift by float error; a split ending within this of the finish is the finish. */
const FINISH_TOLERANCE_M = 1;

/**
 * Where each whole split ends along a route line, for numbered pins on the map.
 *
 * The drawn line is thinned and smoothed, so its length differs a little from the recorded
 * distance; each end is placed in proportion (split k at k * splitMeters / totalMeters of the
 * line) so the pins stay in step with the splits list and none lands past the finish. A split
 * that ends exactly at the finish gets no pin: the finish marker is there.
 */
export function splitMarkers(
  coordinates: readonly LngLatPair[],
  splitMeters: number,
  totalMeters: number
): SplitMarker[] {
  if (splitMeters <= 0 || totalMeters < splitMeters) return [];
  const fractions: number[] = [];
  for (let k = 1; k * splitMeters < totalMeters - FINISH_TOLERANCE_M; k++)
    fractions.push((k * splitMeters) / totalMeters);
  return pointsAtFractions(coordinates, fractions).map((coordinate, i) => ({
    coordinate,
    label: String(i + 1),
  }));
}
