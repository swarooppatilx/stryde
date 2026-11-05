import type { Href } from 'expo-router';
import type { Platform, StorageAdapter } from '@/platform';
import { logger } from '@/utils/logger';
import { parsePushPayload, routeForPush, shouldShowPush } from '@/utils/pushPayload';
import type { PushRegistration } from './pushIntents';

export const PUSH_TOKEN_KEY = '@stryde/push-token';

export type RegisterOutcome = 'registered' | 'no-permission' | 'unavailable';

export interface PushDeps {
  platform: Pick<Platform, 'push'> & { storage: StorageAdapter };
  /** Hands the registration to the local-first outbox, which sends it whenever there is a connection. */
  enqueueRegister(registration: PushRegistration): Promise<void>;
  /** Tells the server now, while the account is still signed in; may throw. */
  unregisterNow(registration: PushRegistration): Promise<void>;
}

export function createPushNotifications({ platform, enqueueRegister, unregisterNow }: PushDeps) {
  const { push, storage } = platform;

  /** Registers this phone if the athlete already allowed notifications; never shows a prompt. */
  async function register(): Promise<RegisterOutcome> {
    if ((await push.getPermission()) !== 'granted') return 'no-permission';
    const projectId = push.projectId();
    if (!projectId) return 'unavailable';
    try {
      await push.setupChannels();
      const token = await push.getToken(projectId);
      if (!token) return 'unavailable';
      await storage.setItem(PUSH_TOKEN_KEY, token);
      await enqueueRegister({ token, platform: push.platform() });
      return 'registered';
    } catch (error) {
      logger.warn('[Push] Registering failed', error);
      return 'unavailable';
    }
  }

  return {
    register,

    /** Asks the system for permission when it has not been asked, then registers. Returns the permission now in force. */
    async enable() {
      let permission = await push.getPermission();
      if (permission === 'undetermined') permission = await push.requestPermission();
      if (permission === 'granted') await register();
      return permission;
    },

    /** Detaches this phone from the signed-in account. A server that cannot be reached is not waited for. */
    async unregister(): Promise<void> {
      const token = await storage.getItem(PUSH_TOKEN_KEY);
      if (!token) return;
      await storage.removeItem(PUSH_TOKEN_KEY);
      try {
        await unregisterNow({ token, platform: push.platform() });
      } catch (error) {
        logger.warn('[Push] Unregistering failed', error);
      }
    },

    /** Foreground filter and tap routing. `open` receives the screen a tapped notification points to. */
    start(open: (href: Href) => void): () => void {
      void push.setupChannels().catch((error) => logger.warn('[Push] Channels failed', error));
      push.setForegroundFilter((data) => shouldShowPush(data));
      const handle = (data: unknown) => {
        const payload = parsePushPayload(data);
        const href = payload ? routeForPush(payload) : null;
        if (href) open(href);
      };
      const subscription = push.onTap(handle);
      void push.takeLaunchTap().then(handle);
      return () => subscription.remove();
    },
  };
}

export type PushNotificationsService = ReturnType<typeof createPushNotifications>;
