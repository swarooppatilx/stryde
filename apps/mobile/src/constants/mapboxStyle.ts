/** Mapbox-hosted base maps: Outdoors (terrain shading, trails) by day, Dark at night. */
export const MAPBOX_STYLE_URL = {
  light: 'mapbox://styles/mapbox/outdoors-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
} as const;

/** Aerial imagery, bare or with streets and labels on top. */
export const MAPBOX_SATELLITE_URL = {
  satellite: 'mapbox://styles/mapbox/satellite-v9',
  hybrid: 'mapbox://styles/mapbox/satellite-streets-v12',
} as const;

export type BaseMapType = 'standard' | 'satellite' | 'hybrid';

export function mapboxStyleUrl(dark: boolean, mapType: BaseMapType = 'standard'): string {
  if (mapType !== 'standard') return MAPBOX_SATELLITE_URL[mapType];
  return dark ? MAPBOX_STYLE_URL.dark : MAPBOX_STYLE_URL.light;
}

/** Whether the base map carries Mapbox Streets data (place labels, the road layer bike lanes are drawn from). */
export function hasStreetData(mapType: BaseMapType): boolean {
  return mapType !== 'satellite';
}

/** Overlays read as on a dark map over imagery: light casings, white labels. */
export function isDarkBase(dark: boolean, mapType: BaseMapType): boolean {
  return dark || mapType !== 'standard';
}

/** Mapbox's elevation tiles, for 3D terrain. */
export const TERRAIN_DEM = {
  id: 'mapbox-dem',
  url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
  tileSize: 514,
  maxZoom: 14,
  exaggeration: 1.4,
} as const;
/** How far the camera leans when 3D terrain is switched on. */
export const TERRAIN_PITCH = 60;

/** Path for a Mapbox Static Images preview of a style, for the map type picker. */
export function staticPreviewUrl(
  styleUrl: string,
  center: [number, number],
  token: string,
  size = { width: 176, height: 128 }
): string {
  const style = styleUrl.replace('mapbox://styles/', '');
  const [lng, lat] = center;
  return `https://api.mapbox.com/styles/v1/${style}/static/${lng.toFixed(4)},${lat.toFixed(4)},13,0/${size.width}x${size.height}@2x?attribution=false&logo=false&access_token=${encodeURIComponent(token)}`;
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
