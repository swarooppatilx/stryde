import { usePrivy } from '@privy-io/expo';
import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';

import { useProfileStore } from '@/stores/profileStore';

const PUBLIC_ROUTES = ['login', 'onboarding'];
const SETUP_ROUTES = ['registering'];

export function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { isReady, user } = usePrivy();
  const isSetup = useProfileStore((s) => s.username.length > 0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!navigationState?.key) return;
    if (!isReady) return;

    const currentRoute = segments[0] ?? '';
    const isPublicRoute = PUBLIC_ROUTES.includes(currentRoute);
    const isSetupRoute = SETUP_ROUTES.includes(currentRoute);
    const isAuthenticated = user !== null;

    if (!isAuthenticated && !isPublicRoute) {
      router.replace('/onboarding' as never);
    } else if (isAuthenticated && isPublicRoute) {
      if (isSetup) {
        router.replace('/(tabs)' as never);
      } else {
        router.replace('/registering' as never);
      }
    } else if (isAuthenticated && !isPublicRoute && !isSetupRoute && !isSetup) {
      router.replace('/registering' as never);
    }

    setReady(true);
  }, [user, isReady, segments, navigationState?.key, isSetup, router.replace]);

  return ready;
}
