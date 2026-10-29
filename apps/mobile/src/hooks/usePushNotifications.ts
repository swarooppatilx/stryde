import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { pushNotifications } from '@/backends/pushNotifications';
import { getPlatform } from '@/platform';
import { usePushPrimerStore } from '@/stores/pushPrimerStore';
import { readOrNull } from '@/utils/readiness';

/**
 * While `enabled` (signed in, app ready): routes notification taps, and registers this phone when the
 * athlete has already allowed notifications. Never prompts; the primer does that.
 */
export function usePushNotifications(enabled: boolean, userId: string | null): void {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    return pushNotifications.start((href) => router.push(href));
  }, [enabled, router]);

  useEffect(() => {
    if (enabled && userId) void pushNotifications.register();
  }, [enabled, userId]);
}

/** The primer's state: shown once its moment came and the system has not been asked yet. */
export function usePushPrimer(enabled: boolean) {
  const status = usePushPrimerStore((s) => s.status);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled || status !== 'due') return;
    let cancelled = false;
    void readOrNull(() => getPlatform().push.getPermission()).then((permission) => {
      if (cancelled) return;
      if (permission === 'undetermined') setOpen(true);
      else usePushPrimerStore.getState().answer();
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, status]);

  const close = () => {
    setOpen(false);
    usePushPrimerStore.getState().answer();
  };
  return {
    open,
    allow: () => {
      close();
      void pushNotifications.enable();
    },
    notNow: close,
  };
}
