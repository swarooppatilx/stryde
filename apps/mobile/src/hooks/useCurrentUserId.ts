import { useSyncExternalStore } from 'react';
import { getCurrentUserId, subscribeCurrentUserId } from '@/constants/currentUser';

/** Re-renders when the signed-in user changes; use instead of reading `getCurrentUserId()` in render. */
export function useCurrentUserId(): string {
  return useSyncExternalStore(subscribeCurrentUserId, getCurrentUserId);
}
