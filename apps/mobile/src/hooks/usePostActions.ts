import { useEffect, useMemo } from 'react';
import { getOutbox } from '@/backends/outbox/appOutbox';
import { getCurrentUserId } from '@/constants/currentUser';
import { getPlatform } from '@/platform';
import {
  type PostActionDeps,
  publishPost,
  removePost,
  requeueOrphans,
} from '@/services/postActions';
import { usePostStore } from '@/stores/postStore';

function postDeps(): PostActionDeps {
  const { clock, ids } = getPlatform();
  const store = usePostStore.getState();
  return {
    author: getCurrentUserId,
    now: () => clock.now(),
    newId: () => ids.next(),
    addPending: store.addPending,
    remove: store.remove,
    enqueue: async (entry) => {
      const outbox = getOutbox();
      await outbox.enqueue(entry);
      void outbox.drain();
    },
  };
}

/** Once the saved queue is back, sends again any post still marked as sending that has nothing queued. */
export function useRequeueOrphanedPosts(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const outbox = getOutbox();
    void outbox.hydrate().then(() => {
      if (stopped) return;
      void requeueOrphans(
        postDeps(),
        Object.values(usePostStore.getState().posts),
        outbox.entries()
      );
    });
    return () => {
      stopped = true;
    };
  }, [enabled]);
}

/** Publishing and removing posts, wired to the post store and the outbox. */
export function usePostActions() {
  return useMemo(
    () => ({
      publish: (input: { text: string; photoUris: readonly string[] }) =>
        publishPost(postDeps(), input),
      remove: (postId: string) => removePost(postDeps(), postId),
    }),
    []
  );
}
