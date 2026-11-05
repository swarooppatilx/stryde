import type { Ionicons } from '@expo/vector-icons';
import type { MapLayer } from '@/stores/mapPrefsStore';

export interface MapLayerOption {
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/** What each switch in the map layers sheet is called, and what it does, in plain words. */
export const MAP_LAYER_OPTIONS: Record<MapLayer, MapLayerOption> = {
  poi: {
    label: 'Places of interest',
    hint: 'Labels for parks and other places',
    icon: 'location-outline',
  },
  bikeLanes: {
    label: 'Bike lanes',
    hint: 'Cycle paths and protected lanes',
    icon: 'bicycle-outline',
  },
  routes: {
    label: 'Your routes',
    hint: 'A line for each of your past activities',
    icon: 'trail-sign-outline',
  },
  heatmap: {
    label: 'Heatmap',
    hint: 'The places you go most often',
    icon: 'flame-outline',
  },
  others: {
    label: 'Routes from others',
    hint: 'Routes other athletes have shared',
    icon: 'people-outline',
  },
};
