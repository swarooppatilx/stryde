import { services } from '@repo/shared';
import { getOutbox } from '@/backends/outbox/appOutbox';
import { useProfileStore } from '@/stores/profileStore';
import { ABOUT_OUTBOX_KEY } from './profileIntents';
import type { SyncAboutDeps } from './syncOwnAbout';

/** Wires `syncOwnAbout` to the viewer's profile, the outbox and the social API. */
export function ownAboutDeps(): SyncAboutDeps {
  return {
    fetch: async (address) => {
      const found = await services.profileAbout.getAbout([address]);
      return found[address.toLowerCase()] ?? null;
    },
    hasUnsentChange: () =>
      getOutbox()
        .entries()
        .some((entry) => entry.key === ABOUT_OUTBOX_KEY),
    current: () => {
      const { bio, location } = useProfileStore.getState();
      return { bio, location };
    },
    apply: (about) => useProfileStore.getState().setAbout(about),
  };
}
