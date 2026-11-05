export type Bounds = [minLng: number, minLat: number, maxLng: number, maxLat: number];

/**
 * Grows `bounds` so that, measured in meters, its shape matches a picture of `aspect` (width over height).
 * Longitude degrees shrink with latitude, so equal degree spans are not equal distances: drawing a box
 * straight into a picture of another shape stretches a circle into an ellipse.
 */
export function fitBoundsToAspect(bounds: Bounds, aspect: number): Bounds {
  const [minLng, minLat, maxLng, maxLat] = bounds;
  const midLat = (minLat + maxLat) / 2;
  const cosLat = Math.cos((midLat * Math.PI) / 180);

  // Work in "meter-like" units: longitude scaled by cos(lat) so both axes are comparable.
  const w = (maxLng - minLng) * cosLat;
  const h = maxLat - minLat;
  const midLng = (minLng + maxLng) / 2;

  let fitW = w;
  let fitH = h;
  if (w / h < aspect) fitW = h * aspect;
  else fitH = w / aspect;

  const halfLng = fitW / cosLat / 2;
  const halfLat = fitH / 2;
  return [midLng - halfLng, midLat - halfLat, midLng + halfLng, midLat + halfLat];
}
