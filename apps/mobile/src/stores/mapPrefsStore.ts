import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SportFilter } from '@/components/filter-chips';
import type { HeatmapColor } from '@/constants/heatmapColors';
import type { DistanceFilter, TimeFilter } from '@/hooks/useMap';
import type { FollowMode } from '@/utils/recordCamera';
import { chainScopedStorageAdapter } from '@/utils/storage';

export type MapLayer = 'routes' | 'heatmap' | 'others' | 'poi' | 'bikeLanes';
export type MapStylePref = 'auto' | 'light' | 'dark';

interface MapPrefsState {
  showRoutes: boolean;
  showHeatmap: boolean;
  showOthers: boolean;
  /** Parks and other places are labelled on the base map. */
  showPoi: boolean;
  showBikeLanes: boolean;
  sport: SportFilter;
  time: TimeFilter;
  distance: DistanceFilter;
  style: MapStylePref;
  /** The colour ramp of the heatmap layer. */
  heatmapColor: HeatmapColor;
  /** How the Record map follows the athlete: remembered between recordings. */
  recordFollowMode: FollowMode;
  setLayer: (layer: MapLayer, on: boolean) => void;
  setSport: (sport: SportFilter) => void;
  setTime: (time: TimeFilter) => void;
  setDistance: (distance: DistanceFilter) => void;
  setStyle: (style: MapStylePref) => void;
  setHeatmapColor: (color: HeatmapColor) => void;
  setRecordFollowMode: (mode: FollowMode) => void;
  /** Opens every filter again; layers stay as they are. */
  clearFilters: () => void;
  reset: () => void;
}

const OPEN_FILTERS = { sport: 'all', time: 'all', distance: 'any' } as const;
const DEFAULTS = {
  showRoutes: false,
  showHeatmap: false,
  showOthers: false,
  showPoi: true,
  showBikeLanes: false,
  style: 'auto',
  heatmapColor: 'classic',
  recordFollowMode: 'north',
  ...OPEN_FILTERS,
} as const;

/** Which layers and filters the Map tab was left with, so it opens the way it was closed (this device only). */
export const useMapPrefsStore = create<MapPrefsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setLayer: (layer, on) =>
        set(
          {
            routes: { showRoutes: on },
            heatmap: { showHeatmap: on },
            others: { showOthers: on },
            poi: { showPoi: on },
            bikeLanes: { showBikeLanes: on },
          }[layer]
        ),
      setSport: (sport) => set({ sport }),
      setTime: (time) => set({ time }),
      setDistance: (distance) => set({ distance }),
      setStyle: (style) => set({ style }),
      setHeatmapColor: (heatmapColor) => set({ heatmapColor }),
      setRecordFollowMode: (recordFollowMode) => set({ recordFollowMode }),
      clearFilters: () => set({ ...OPEN_FILTERS }),
      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: '@stryde/map-prefs',
      version: 1,
      storage: createJSONStorage(() => chainScopedStorageAdapter),
    }
  )
);

/** Whether any filter narrows what the map shows. */
export function hasActiveFilters(
  prefs: Pick<MapPrefsState, 'sport' | 'time' | 'distance'>
): boolean {
  return (
    prefs.sport !== OPEN_FILTERS.sport ||
    prefs.time !== OPEN_FILTERS.time ||
    prefs.distance !== OPEN_FILTERS.distance
  );
}

/** The base map to draw: the app's own theme unless the athlete picked one. */
export function resolveMapStyle(pref: MapStylePref, appIsDark: boolean): 'light' | 'dark' {
  if (pref === 'auto') return appIsDark ? 'dark' : 'light';
  return pref;
}

/** How many optional overlays are on: the number shown on the layers button. Labels on the base map do not count. */
export function layerBadgeCount(
  prefs: Pick<MapPrefsState, 'showRoutes' | 'showHeatmap' | 'showOthers' | 'showBikeLanes'>
): number {
  return [prefs.showRoutes, prefs.showHeatmap, prefs.showOthers, prefs.showBikeLanes].filter(
    Boolean
  ).length;
}

/** Whether one layer's switch is on. */
export function isLayerOn(
  prefs: Pick<
    MapPrefsState,
    'showRoutes' | 'showHeatmap' | 'showOthers' | 'showPoi' | 'showBikeLanes'
  >,
  layer: MapLayer
): boolean {
  return {
    routes: prefs.showRoutes,
    heatmap: prefs.showHeatmap,
    others: prefs.showOthers,
    poi: prefs.showPoi,
    bikeLanes: prefs.showBikeLanes,
  }[layer];
}
