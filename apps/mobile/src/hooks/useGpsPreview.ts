import { useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';
import { lazyService } from '@/platform';
import { createGpsPreview } from '@/services/gpsPreview';
import type { Location } from '@/types';

const gpsPreview = lazyService((platform) => createGpsPreview({ location: platform.location }));

/** The newest GPS fix while this screen is focused and `enabled`; null otherwise or before the first one. */
export function useGpsPreview(enabled: boolean): Location | null {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      void gpsPreview.start();
      return () => gpsPreview.stop();
    }, [enabled])
  );

  const subscribe = useCallback((onChange: () => void) => gpsPreview.subscribe(onChange), []);
  const getSnapshot = useCallback(() => gpsPreview.getSnapshot(), []);
  return useSyncExternalStore(subscribe, getSnapshot);
}
