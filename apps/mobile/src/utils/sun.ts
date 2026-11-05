const RAD = Math.PI / 180;

/** Sun's height above the horizon (degrees) at a place and moment; NOAA's approximation, good to a fraction of a degree. */
export function solarElevation(timestampMs: number, latitude: number, longitude: number): number {
  const date = new Date(timestampMs);
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((timestampMs - startOfYear) / 86_400_000) + 1;
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  // Fractional year, in radians.
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (hour - 12) / 24);
  const eqTimeMin =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const declination =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);

  const trueSolarMin = hour * 60 + eqTimeMin + 4 * longitude;
  const hourAngle = (trueSolarMin / 4 - 180) * RAD;
  const lat = latitude * RAD;
  const cosZenith =
    Math.sin(lat) * Math.sin(declination) +
    Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
  return 90 - Math.acos(Math.max(-1, Math.min(1, cosZenith))) / RAD;
}

/** Between sunset and sunrise at that place (the sun's top edge below the horizon, refraction allowed for). */
export function isAfterDark(timestampMs: number, latitude: number, longitude: number): boolean {
  return solarElevation(timestampMs, latitude, longitude) < -0.833;
}
