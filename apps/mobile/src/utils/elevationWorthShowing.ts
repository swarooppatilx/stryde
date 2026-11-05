interface Profile {
  elevations: readonly number[];
  totalAscent: number;
  totalDescent: number;
}

/** A climb or a drop smaller than this is the map data's noise, not a hill. */
const MIN_REAL_CHANGE_M = 3;

/**
 * Whether an elevation profile says anything: it needs a few points to draw, and either a real
 * climb or descent or a spread of several metres. A flat route reads "0 m up, 0 m down" otherwise.
 */
export function elevationWorthShowing({ elevations, totalAscent, totalDescent }: Profile): boolean {
  if (elevations.length < 2) return false;
  if (totalAscent >= MIN_REAL_CHANGE_M || totalDescent >= MIN_REAL_CHANGE_M) return true;
  return Math.max(...elevations) - Math.min(...elevations) >= MIN_REAL_CHANGE_M * 2;
}
