import { usePrivy } from '@privy-io/expo';
import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useProfileStore } from '@/stores/profileStore';

const PUBLIC_ROUTES = ['login', 'onboarding'];
const SETUP_ROUTES = ['registering', 'profile-setup'];

export function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { isReady, user } = usePrivy();
  const isSetup = useProfileStore((s) => s.firstName.length > 0 || s.username.length > 0);
  const [ready, setReady] = useState(false);
  const lastRoutedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!navigationState?.key) return;
    if (!isReady) return;

    const currentRoute = segments[0] ?? '';
    const isPublicRoute = PUBLIC_ROUTES.includes(currentRoute);
    const isSetupRoute = SETUP_ROUTES.includes(currentRoute);
    const isAuthenticated = user !== null;

    let target: string | null = null;

    if (!isAuthenticated && !isPublicRoute) {
      target = '/onboarding';
    } else if (isAuthenticated && isPublicRoute) {
      target = isSetup ? '/(tabs)' : '/registering';
    } else if (isAuthenticated && !isPublicRoute && !isSetupRoute && !isSetup) {
      target = '/registering';
    }

    const routeKey = target ?? 'ok';
    if (routeKey === lastRoutedKey.current) return;
    lastRoutedKey.current = routeKey;

    if (target) {
      router.replace(target as never);
    }

    setReady(true);
  }, [navigationState?.key, isReady, isSetup, segments, user, router.replace]);

  return ready;
}
