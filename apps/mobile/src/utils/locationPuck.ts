import type { LngLatPair } from './mapData';

export interface PuckPosition {
  coordinate: LngLatPair;
  /** Horizontal accuracy in metres. */
  accuracy: number;
  /** Direction of travel in degrees, or null when unknown. */
  heading: number | null;
}

/** Metres per pixel of a 512 px tile at zoom 0 on the equator. */
const METERS_PER_PIXEL_Z0 = 78271.517;

/**
 * The one feature the position puck is drawn from. `accuracyPx` is the accuracy circle's radius in
 * pixels at zoom 0, which the map doubles for each zoom level to keep it true to the ground.
 */
export function puckFeatureCollection(
  position: PuckPosition | null
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  if (!position) return { type: 'FeatureCollection', features: [] };
  const [lng, lat] = position.coordinate;
  const groundPerPixel = METERS_PER_PIXEL_Z0 * Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          accuracyPx: Math.max(0, position.accuracy) / groundPerPixel,
          ...(position.heading === null ? {} : { heading: position.heading }),
        },
      },
    ],
  };
}
