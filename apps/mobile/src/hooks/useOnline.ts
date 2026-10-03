import { useCallback, useSyncExternalStore } from 'react';
import { onlineStatus } from '@/services/onlineStatus';

export function useOnline(): boolean {
  // The lazy service hands out a fresh bound function on every read, and
  // useSyncExternalStore resubscribes whenever `subscribe` changes identity.
  const subscribe = useCallback((onChange: () => void) => onlineStatus.subscribe(onChange), []);
  const getSnapshot = useCallback(() => onlineStatus.getSnapshot(), []);
  return useSyncExternalStore(subscribe, getSnapshot);
}
