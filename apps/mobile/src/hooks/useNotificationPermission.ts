import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { getPlatform } from '@/platform';
import { readOrNull } from '@/utils/readiness';

/** Whether the phone lets Stryde notify, read again each time the screen is shown (the athlete may have just changed it); null until answered or when the phone will not say. */
export function useNotificationPermission(): boolean | null {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void readOrNull(() => getPlatform().readiness.notificationsAllowed()).then((value) => {
        if (!cancelled) setAllowed(value);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );
  return allowed;
}
