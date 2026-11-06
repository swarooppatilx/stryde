import type { OfflineMapStatus } from '@/services/offlineMaps';
import { logger } from '@/utils/logger';
import type { RegionBounds } from '@/utils/offlineEstimate';

export interface PackProgress {
  state: string;
  percentage: number;
  completedResourceSize: number;
}

export interface StoredPack {
  name: string;
  metadata?: unknown;
  status(): Promise<PackProgress>;
}

/** The native offline manager, as far as regions need it; the app wires the Mapbox one and tests wire a fake. */
export interface OfflinePacksPort {
  list(): Promise<StoredPack[]>;
  create(
    options: {
      name: string;
      styleURL: string;
      bounds: RegionBounds;
      minZoom: number;
      maxZoom: number;
      metadata: Record<string, string>;
    },
    onProgress: (status: PackProgress) => void,
    onError: (error: unknown) => void
  ): Promise<void>;
  remove(name: string): Promise<void>;
}

export const AREA_PREFIX = 'area-';

export interface OfflineRegion {
  /** Pack name; pass it back to remove. */
  id: string;
  name: string;
  bytes: number;
  ready: boolean;
  percent: number;
}

export interface OfflineStorage {
  regions: OfflineRegion[];
  /** What every offline map on the phone uses, saved routes' maps included. */
  totalBytes: number;
  /** Saved routes' maps, which are managed from each route. */
  routeMapCount: number;
}

export function toStatus(status: PackProgress): OfflineMapStatus {
  if (status.state === 'complete' || status.percentage >= 100) {
    return { state: 'ready', percent: 100, bytes: status.completedResourceSize };
  }
  return {
    state: 'downloading',
    percent: Math.round(status.percentage),
    bytes: status.completedResourceSize,
  };
}

function nameOf(metadata: unknown, fallback: string): string {
  if (typeof metadata === 'object' && metadata !== null && 'name' in metadata) {
    const name = (metadata as { name: unknown }).name;
    if (typeof name === 'string' && name.trim()) return name;
  }
  return fallback;
}

/** Starts downloading a named area; `onStatus` hears every step until it is ready or fails. */
export async function downloadRegion(
  port: OfflinePacksPort,
  region: {
    name: string;
    styleURL: string;
    bounds: RegionBounds;
    minZoom: number;
    maxZoom: number;
    stamp: number;
  },
  onStatus: (status: OfflineMapStatus) => void
): Promise<void> {
  const id = `${AREA_PREFIX}${region.stamp}`;
  onStatus({ state: 'downloading', percent: 0, bytes: 0 });
  try {
    await port.create(
      {
        name: id,
        styleURL: region.styleURL,
        bounds: region.bounds,
        minZoom: region.minZoom,
        maxZoom: region.maxZoom,
        metadata: { name: region.name },
      },
      (status) => onStatus(toStatus(status)),
      (error) => {
        logger.warn('[OfflineMaps] Area download failed', error);
        onStatus({ state: 'failed', percent: 0, bytes: 0 });
      }
    );
  } catch (error) {
    logger.warn('[OfflineMaps] Could not start the area download', error);
    onStatus({ state: 'failed', percent: 0, bytes: 0 });
  }
}

export async function listOfflineStorage(port: OfflinePacksPort): Promise<OfflineStorage> {
  const packs = await port.list();
  const rows = await Promise.all(
    packs.map(async (pack) => {
      const status = toStatus(await pack.status());
      return { pack, status };
    })
  );
  const regions = rows
    .filter(({ pack }) => pack.name.startsWith(AREA_PREFIX))
    .map<OfflineRegion>(({ pack, status }) => ({
      id: pack.name,
      name: nameOf(pack.metadata, 'Saved area'),
      bytes: status.bytes,
      ready: status.state === 'ready',
      percent: status.percent,
    }));
  return {
    regions,
    totalBytes: rows.reduce((sum, { status }) => sum + status.bytes, 0),
    routeMapCount: rows.filter(({ pack }) => pack.name.startsWith('route-')).length,
  };
}

/** Removes one saved area; only packs this feature named can be removed here. */
export async function removeRegion(port: OfflinePacksPort, id: string): Promise<boolean> {
  if (!id.startsWith(AREA_PREFIX)) return false;
  await port.remove(id);
  return true;
}
