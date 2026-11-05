import { Palette } from '@/constants/palette';

/** A style with only a background layer: enough for the map to draw overlays on. */
export interface BackgroundOnlyStyle {
  version: 8;
  sources: Record<string, never>;
  layers: [{ id: string; type: 'background'; paint: { 'background-color': string } }];
}

/** Plain-background fallback used when the real style cannot be fetched offline. */
export function offlineMapStyle(dark: boolean): BackgroundOnlyStyle {
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
