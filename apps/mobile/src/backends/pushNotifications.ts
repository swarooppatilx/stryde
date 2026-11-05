import { services } from '@repo/shared';
import { getActiveProfileId } from '@/backends/activeProfile';
import { getOutbox, registerOutboxHandler } from '@/backends/outbox/appOutbox';
import { PROFILES } from '@/backends/profiles';
import { lazyService } from '@/platform';
import { createPushRegisterHandler, PUSH_KEY, REGISTER_PUSH } from '@/services/pushIntents';
import { createPushNotifications } from '@/services/pushNotifications';
import { getActiveWallet } from '@/services/wallet';

/** Teaches the outbox how a push registration is signed and sent. */
export function registerPushIntents(): void {
  registerOutboxHandler(
    REGISTER_PUSH,
    createPushRegisterHandler({
      wallet: getActiveWallet,
      send: (wallet, registration) => services.push.registerPushToken(wallet, registration),
    })
  );
}

/** Push for the running app. A profile with no backend registers nothing: the outbox acknowledges it and nobody could send. */
export const pushNotifications = lazyService((platform) =>
  createPushNotifications({
    platform,
    async enqueueRegister(registration) {
      const outbox = getOutbox();
      await outbox.enqueue({ kind: REGISTER_PUSH, key: PUSH_KEY, payload: registration });
      void outbox.drain();
    },
    async unregisterNow(registration) {
      const wallet = getActiveWallet();
      if (!wallet || PROFILES[getActiveProfileId()].fakeChain) return;
      await services.push.unregisterPushToken(wallet, registration);
    },
  })
);
