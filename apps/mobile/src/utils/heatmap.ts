import { isAfterDark } from '@/utils/sun';

/** Whose activities the heatmap is built from. */
export type HeatmapSource = 'personal' | 'community';
/** Which of them: everything, the last seven days, or only those recorded after dark. */
export type HeatmapPeriod = 'all' | 'weekly' | 'night' | 'custom';

export const HEATMAP_SOURCE_LABELS: Record<HeatmapSource, string> = {
  personal: 'Personal',
  community: 'Community',
};
export const HEATMAP_PERIOD_LABELS: Record<HeatmapPeriod, string> = {
  all: 'All time',
  weekly: 'Weekly',
  night: 'Night',
  custom: 'Dates',
};

/** From the start of the first day to the end of the last, in ms since 1970. */
export interface HeatmapRange {
  fromMs: number;
  toMs: number;
}

const WEEK_MS = 7 * 86_400_000;

export interface HeatRoute {
  coordinates: [number, number][];
  /** When the activity was recorded, ms since 1970; unknown leaves it out of Weekly and Night. */
  timestampMs?: number;
}

/** Whether a route belongs on the heatmap for the period. Night is judged where and when it started. */
export function inHeatmapPeriod(
  route: HeatRoute,
  period: HeatmapPeriod,
  nowMs: number,
  range?: HeatmapRange | null
): boolean {
  if (period === 'all') return true;
  const t = route.timestampMs;
  if (t === undefined || !Number.isFinite(t)) return false;
  if (period === 'weekly') return nowMs - t <= WEEK_MS && t <= nowMs;
  if (period === 'custom') return range ? t >= range.fromMs && t <= range.toMs : true;
  const start = route.coordinates[0];
  return start ? isAfterDark(t, start[1], start[0]) : false;
}

/** A spot on the heatmap: [lng, lat, how many activities pass through it]. */
export type HeatCell = [number, number, number];

/**
 * Snaps every route onto a fine grid (about 25 m) and counts the distinct activities through each
 * cell, so a street run every day burns hotter than one run once.
 */
export function heatCells(
  routes: readonly HeatRoute[],
  gridDivisor = 4000,
  maxCells = 2000
): HeatCell[] {
  const counts = new Map<string, HeatCell>();
  const onGrid = (v: number) => Math.round(v * gridDivisor) / gridDivisor;
  for (const route of routes) {
    const visited = new Set<string>();
    for (const [lng, lat] of route.coordinates) {
      const cellLng = onGrid(lng);
      const cellLat = onGrid(lat);
      const key = `${cellLng},${cellLat}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const cell = counts.get(key);
      if (cell) cell[2] += 1;
      else counts.set(key, [cellLng, cellLat, 1]);
    }
  }
  // Too many cells to draw smoothly: keep the hottest.
  const cells = [...counts.values()];
  return cells.length > maxCells ? cells.sort((a, b) => b[2] - a[2]).slice(0, maxCells) : cells;
}
