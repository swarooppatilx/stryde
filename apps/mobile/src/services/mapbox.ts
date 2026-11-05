import Mapbox from '@rnmapbox/maps';
import { ENV } from '@/constants/config';
import { logger } from '@/utils/logger';

let configured = false;

/** Hands the access token to the native SDK once; false when the build has none. */
export function ensureMapbox(): boolean {
  if (!ENV.MAPBOX_ACCESS_TOKEN) return false;
  if (!configured) {
    configured = true;
    Mapbox.setAccessToken(ENV.MAPBOX_ACCESS_TOKEN).catch((error: unknown) =>
      logger.warn('[Map] Could not set the Mapbox access token', error)
    );
  }
  return true;
}
