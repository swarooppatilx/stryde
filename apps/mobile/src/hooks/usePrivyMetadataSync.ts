import { usePrivy } from '@privy-io/expo';
import { useEffect } from 'react';

import { fetchPrivyMetadata } from '@/services/profileService';
import { useProfileStore } from '@/stores/profileStore';

export function usePrivyMetadataSync() {
  const { user } = usePrivy();

  useEffect(() => {
    if (!user?.id) return;

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
      .catch(() => {
        // Metadata sync is best-effort; the user can set their name later.
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
}
