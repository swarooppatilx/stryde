import { useCallback } from 'react';
import { getOutbox } from '@/backends/outbox/appOutbox';
import { ABOUT_OUTBOX_KEY, SET_ABOUT, type SetAboutIntent } from '@/services/profileIntents';
import { type AboutResult, type AboutText, requestAbout } from '@/services/requestAbout';
import { useProfileStore } from '@/stores/profileStore';

/** Saves the bio and location: the new text shows at once and the outbox delivers it to the server. */
export function useAboutSave() {
  const bio = useProfileStore((s) => s.bio);
  const location = useProfileStore((s) => s.location);
  const setAbout = useProfileStore((s) => s.setAbout);

  return useCallback(
    async (next: AboutText): Promise<AboutResult> => {
      const outbox = getOutbox();
      return requestAbout(
        {
          showLocally: setAbout,
          unsentPrevious: () => {
            const waiting = outbox.entries().find((entry) => entry.key === ABOUT_OUTBOX_KEY);
            return (waiting?.payload as SetAboutIntent | undefined)?.previous;
          },
          queue: async (intent) => {
            await outbox.enqueue({ kind: SET_ABOUT, key: ABOUT_OUTBOX_KEY, payload: intent });
            void outbox.drain();
          },
        },
        { bio, location },
        next
      );
    },
    [bio, location, setAbout]
  );
}
