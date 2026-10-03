import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useViemWallet } from '@/hooks/useViemWallet';
import { lookupUsername } from '@/services/profileLookup';
import { isRegisteredOnChain } from '@/services/registration';
import { useProfileStore } from '@/stores/profileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { selectAccountSetup, useSetupStore } from '@/stores/setupStore';
import { logger } from '@/utils/logger';
import { routeTarget } from '@/utils/routeTarget';
import { needsSetupFlow } from '@/utils/setupFlow';

export function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { isReady, user } = useAuth();
  const { address, isLoading: walletLoading } = useViemWallet();
  const localIsSetup = useProfileStore((s) => s.firstName.length > 0 || s.username.length > 0);
  const setUsername = useProfileStore((s) => s.setUsername);
  const setWallet = useProfileStore((s) => s.setWallet);
  const hasOnboarded = useSettingsStore((s) => s.hasOnboarded);
  const setHasOnboarded = useSettingsStore((s) => s.setHasOnboarded);
  const accountId = useCurrentUserId();
  const setupFlowPending = useSetupStore((s) => needsSetupFlow(selectAccountSetup(accountId)(s)));
  const [ready, setReady] = useState(false);
  const [onChainRegistered, setOnChainRegistered] = useState(false);
  // Defaults to true so routing waits for the on-chain fallback check instead of firing on the first render.
  const [onChainCheckPending, setOnChainCheckPending] = useState(true);
  const lastRoutedKey = useRef<string | null>(null);

  const isAuthenticated = user !== null;
  // `isSetup` lives in a store wiped on logout or reinstall, so a registered wallet can arrive with isSetup=false; only then pay for an on-chain lookup.
  const needsOnChainCheck = !localIsSetup && isAuthenticated;
  const checkingOnChain = needsOnChainCheck && (walletLoading || onChainCheckPending);
  const isSetup = localIsSetup || onChainRegistered;

  useEffect(() => {
    if (!needsOnChainCheck) return;
    if (walletLoading) return;

    if (!address) {
      // No address to verify on-chain; fall through to the normal not-setup routing.
      setOnChainCheckPending(false);
      return;
    }

    // Captured separately so the non-null narrowing survives into the async closure.
    const verifiedAddress = address;
    let cancelled = false;

    async function check() {
      try {
        const registered = await isRegisteredOnChain(verifiedAddress);
        if (cancelled) return;
        setOnChainRegistered(registered);

        if (registered) {
          const username = await lookupUsername(verifiedAddress);
          if (username) setUsername(username);
          setWallet(verifiedAddress);
        }
      } catch (e) {
        logger.warn('[Auth] Failed to check on-chain registration:', e);
        if (!cancelled) setOnChainRegistered(false);
      } finally {
        if (!cancelled) setOnChainCheckPending(false);
      }
    }

    void check();

    return () => {
      cancelled = true;
    };
  }, [needsOnChainCheck, walletLoading, address, setUsername, setWallet]);

  useEffect(() => {
    if (!navigationState?.key) return;
    if (!isReady) return;
    if (checkingOnChain) return;

    // Anyone who has authenticated has seen onboarding; do not replay it after logout.
    if (isAuthenticated && !hasOnboarded) {
      setHasOnboarded();
    }

    const target = routeTarget({
      currentRoute: segments[0] ?? '',
      isAuthenticated,
      isSetup,
      hasOnboarded,
      setupFlowPending,
    });

    const routeKey = target ?? 'ok';
    if (routeKey === lastRoutedKey.current) return;
    lastRoutedKey.current = routeKey;

    if (target) {
      router.replace(target);
    }

    setReady(true);
  }, [
    navigationState?.key,
    isReady,
    checkingOnChain,
    isSetup,
    setupFlowPending,
    hasOnboarded,
    setHasOnboarded,
    segments,
    isAuthenticated,
    router.replace,
  ]);

  return ready;
}
