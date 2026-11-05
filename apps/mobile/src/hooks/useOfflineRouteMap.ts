import { useCallback, useEffect, useState } from 'react';
import {
  downloadRouteMap,
  NO_OFFLINE_MAP,
  type OfflineMapStatus,
  removeRouteMap,
  routeMapStatus,
} from '@/services/offlineMaps';
import type { RoutePoint } from '@/utils/route';

/** A saved route's offline map: whether it is on the phone, and ways to get or drop it. */
export function useOfflineRouteMap(routeId: string, line: readonly RoutePoint[], styleURL: string) {
  const [status, setStatus] = useState<OfflineMapStatus>(NO_OFFLINE_MAP);

  useEffect(() => {
    let cancelled = false;
    void routeMapStatus(routeId).then((found) => {
      if (!cancelled) setStatus(found);
    });
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  const download = useCallback(
    () => downloadRouteMap(routeId, line, styleURL, setStatus),
    [routeId, line, styleURL]
  );
  const remove = useCallback(async () => {
    await removeRouteMap(routeId);
    setStatus(NO_OFFLINE_MAP);
  }, [routeId]);

  return { status, download, remove };
}
