import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { listDownloadedRouteIds } from '@/services/offlineMaps';

/** Saved routes with their map on the phone; refreshed whenever the screen comes into view. */
export function useDownloadedRouteIds(): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void listDownloadedRouteIds().then((found) => {
        if (!cancelled) setIds(found);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );
  return ids;
}
