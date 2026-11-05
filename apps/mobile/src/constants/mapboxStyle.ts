/** Mapbox-hosted base maps: Outdoors (terrain shading, trails) by day, Dark at night. */
export const MAPBOX_STYLE_URL = {
  light: 'mapbox://styles/mapbox/outdoors-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
} as const;

export function mapboxStyleUrl(dark: boolean): string {
  return dark ? MAPBOX_STYLE_URL.dark : MAPBOX_STYLE_URL.light;
}

/** Font stacks the Mapbox glyph server has; Arial Unicode covers the arrow and chevron symbols. */
export const MAPBOX_FONT = {
  regular: ['DIN Pro Medium', 'Arial Unicode MS Regular'],
  bold: ['DIN Pro Bold', 'Arial Unicode MS Bold'],
};

/** Place labels in both base styles; hidden when the athlete turns places of interest off. */
export const POI_LABEL_LAYER = 'poi-label';

/** Cycle paths in the Mapbox Streets tiles both styles draw from. */
export const BIKE_LANE_SOURCE = { sourceID: 'composite', sourceLayerID: 'road' } as const;
export const BIKE_LANE_FILTER = [
  'all',
  ['==', ['get', 'class'], 'path'],
  ['==', ['get', 'type'], 'cycleway'],
] as const;
export const BIKE_LANE_COLOR = '#1E9E5A';
