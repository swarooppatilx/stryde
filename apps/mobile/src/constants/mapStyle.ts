import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { Palette } from '@/constants/palette';

/** Plain-background fallback used when the real style cannot be fetched offline. */
export function offlineMapStyle(dark: boolean): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': dark ? Palette.neutral.n1 : Palette.neutral.n6 },
      },
    ],
  };
}
