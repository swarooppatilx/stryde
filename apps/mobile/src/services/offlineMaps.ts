import { offlineManager } from '@rnmapbox/maps';
import { ensureMapbox } from '@/services/mapbox';
import { logger } from '@/utils/logger';
import {
  OFFLINE_ZOOM,
  offlineBounds,
  offlinePackName,
  routeIdFromPackName,
} from '@/utils/offlineRegion';
import type { RoutePoint } from '@/utils/route';

export interface OfflineMapStatus {
  state: 'none' | 'downloading' | 'ready' | 'failed';
  /** 0–100 while downloading. */
  percent: number;
  /** Bytes on the phone so far. */
  bytes: number;
}

export const NO_OFFLINE_MAP: OfflineMapStatus = { state: 'none', percent: 0, bytes: 0 };

type ProgressStatus = {
  state: string;
  percentage: number;
  completedResourceSize: number;
};

function toStatus(status: ProgressStatus): OfflineMapStatus {
  if (status.state === 'complete' || status.percentage >= 100) {
    return { state: 'ready', percent: 100, bytes: status.completedResourceSize };
  }
  return {
    state: 'downloading',
    percent: Math.round(status.percentage),
    bytes: status.completedResourceSize,
  };
}

/** What is on the phone for a route's map. */
export async function routeMapStatus(routeId: string): Promise<OfflineMapStatus> {
  if (!ensureMapbox()) return NO_OFFLINE_MAP;
  try {
    const pack = await offlineManager.getPack(offlinePackName(routeId));
    if (!pack) return NO_OFFLINE_MAP;
    return toStatus((await pack.status()) as unknown as ProgressStatus);
  } catch (error) {
    logger.warn('[OfflineMaps] Could not read the offline map', error);
    return NO_OFFLINE_MAP;
  }
}

/**
 * Downloads the map around a route (in the given style) for use without a signal, replacing any
 * earlier download. `onStatus` hears every step until it is ready or fails.
 */
export async function downloadRouteMap(
  routeId: string,
  line: readonly RoutePoint[],
  styleURL: string,
  onStatus: (status: OfflineMapStatus) => void
): Promise<void> {
  const bounds = offlineBounds(line);
  if (!bounds || !ensureMapbox()) {
    onStatus({ ...NO_OFFLINE_MAP, state: 'failed' });
    return;
  }
  const name = offlinePackName(routeId);
  await offlineManager.deletePack(name).catch(() => {});
  onStatus({ state: 'downloading', percent: 0, bytes: 0 });
  await offlineManager.createPack(
    {
      name,
      styleURL,
      bounds,
      minZoom: OFFLINE_ZOOM.min,
      maxZoom: OFFLINE_ZOOM.max,
      metadata: { routeId },
    },
    (_pack, status) => onStatus(toStatus(status as unknown as ProgressStatus)),
    (_pack, error) => {
      logger.warn('[OfflineMaps] Download failed', error);
      onStatus({ ...NO_OFFLINE_MAP, state: 'failed' });
    }
  );
}

export async function removeRouteMap(routeId: string): Promise<void> {
  if (!ensureMapbox()) return;
  await offlineManager
    .deletePack(offlinePackName(routeId))
    .catch((error: unknown) =>
      logger.warn('[OfflineMaps] Could not remove the offline map', error)
    );
}

/** Ids of the saved routes whose map is fully on the phone. */
export async function listDownloadedRouteIds(): Promise<Set<string>> {
  if (!ensureMapbox()) return new Set();
  try {
    const packs = await offlineManager.getPacks();
    const ids = await Promise.all(
      packs.map(async (pack) => {
        const id = routeIdFromPackName(pack.name);
        if (!id) return null;
        const status = (await pack.status()) as unknown as ProgressStatus;
        return toStatus(status).state === 'ready' ? id : null;
      })
    );
    return new Set(ids.filter((id): id is string => id !== null));
  } catch (error) {
    logger.warn('[OfflineMaps] Could not list offline maps', error);
    return new Set();
  }
}
