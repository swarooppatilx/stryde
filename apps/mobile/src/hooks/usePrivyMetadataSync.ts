import { useEffect } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { fetchPrivyMetadata } from '@/services/profileService';
import { useProfileStore } from '@/stores/profileStore';
import { logger } from '@/utils/logger';

export function usePrivyMetadataSync() {
  const { user } = useAuth();

  useEffect(() => {
    // Only a real account has metadata to read; a developer persona has none.
    if (!user?.id || user.kind !== 'privy') return;

    useProfileStore.getState().setPrivyUserId(user.id);

    const localUsername = useProfileStore.getState().username;
    if (localUsername.length > 0) return;

    let cancelled = false;
    fetchPrivyMetadata(user.id)
      .then((metadata) => {
        if (!cancelled && metadata?.username) {
          useProfileStore.getState().setUsername(metadata.username);
        }
        if (!cancelled && metadata?.firstName) {
          useProfileStore.getState().setFirstName(metadata.firstName);
        }
        if (!cancelled && metadata?.lastName) {
          useProfileStore.getState().setLastName(metadata.lastName);
        }
      })
      .catch((error) => {
        // Best-effort: the user can set their name later.
        logger.warn('[PrivyMetadataSync] Failed', error);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.kind]);
}
