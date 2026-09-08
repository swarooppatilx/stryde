import { usePrivy } from '@privy-io/expo';
import { services } from '@repo/shared';
import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { ENV } from '@/constants/config';
import { useViemWallet } from '@/hooks/useViemWallet';
import { useProfileStore } from '@/stores/profileStore';
import { useSettingsStore } from '@/stores/settingsStore';

const PUBLIC_ROUTES = ['login', 'onboarding'];
const SETUP_ROUTES = ['registering', 'profile-setup'];

export function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { isReady, user } = usePrivy();
  const { address, isLoading: walletLoading } = useViemWallet(ENV.CHAIN_MODE);
  const localIsSetup = useProfileStore((s) => s.firstName.length > 0 || s.username.length > 0);
  const setUsername = useProfileStore((s) => s.setUsername);
  const setWallet = useProfileStore((s) => s.setWallet);
  const hasOnboarded = useSettingsStore((s) => s.hasOnboarded);
  const setHasOnboarded = useSettingsStore((s) => s.setHasOnboarded);
  const [ready, setReady] = useState(false);
  const [onChainRegistered, setOnChainRegistered] = useState(false);
  // Defaults to true so the routing decision below waits for the on-chain
  // fallback check (when one is needed) instead of firing on the very first
  // render, before the check-in-progress state has had a chance to be set.
  const [onChainCheckPending, setOnChainCheckPending] = useState(true);
  const lastRoutedKey = useRef<string | null>(null);

  const isAuthenticated = user !== null;
  // The local `isSetup` flag lives in a persisted store that gets wiped on
  // logout or a fresh install, so a returning, already-registered wallet can
  // land here with isSetup=false. Only in that specific case do we pay for
  // an on-chain lookup — already-set-up users keep the fast, local-only path.
  const needsOnChainCheck = !localIsSetup && isAuthenticated;
  const checkingOnChain = needsOnChainCheck && (walletLoading || onChainCheckPending);
  const isSetup = localIsSetup || onChainRegistered;

  useEffect(() => {
    if (!needsOnChainCheck) return;
    if (walletLoading) return;

    if (!address) {
      // Wallet finished loading but produced no address — nothing to verify
      // on-chain, fall through to the normal (not-setup) routing decision.
      setOnChainCheckPending(false);
      return;
    }

    // Captured separately so TS keeps the non-null narrowing inside the
    // nested async closure below (narrowing doesn't cross function scopes).
    const verifiedAddress = address;
    let cancelled = false;

    async function check() {
      try {
        const registered = await services.profile.isRegistered(verifiedAddress);
        if (cancelled) return;
        setOnChainRegistered(registered);

        if (registered) {
          // Try direct lookup first — avoids fetching ALL registered users
          try {
            const users = await services.profile.getRegisteredUsers();
            const match = users.find(
              (u) => u.wallet.toLowerCase() === verifiedAddress.toLowerCase()
            );
            if (match) {
              setUsername(match.username);
            }
          } catch (e) {
            console.warn('[Auth] Failed to repair local store:', e);
          }
          setWallet(verifiedAddress);
        }
      } catch (e) {
        console.warn('[Auth] Failed to check on-chain registration:', e);
        if (!cancelled) setOnChainRegistered(false);
      } finally {
        if (!cancelled) setOnChainCheckPending(false);
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, [needsOnChainCheck, walletLoading, address, setUsername, setWallet]);

  useEffect(() => {
    if (!navigationState?.key) return;
    if (!isReady) return;
    if (checkingOnChain) return;

    const currentRoute = segments[0] ?? '';
    const isPublicRoute = PUBLIC_ROUTES.includes(currentRoute);
    const isSetupRoute = SETUP_ROUTES.includes(currentRoute);

    // Anyone who has ever authenticated has necessarily seen onboarding -
    // don't make a returning user replay the carousel just because they
    // logged out.
    if (isAuthenticated && !hasOnboarded) {
      setHasOnboarded();
    }

    let target: string | null = null;

    if (!isAuthenticated && !isPublicRoute) {
      target = hasOnboarded ? '/login' : '/onboarding';
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
  }, [
    navigationState?.key,
    isReady,
    checkingOnChain,
    isSetup,
    hasOnboarded,
    setHasOnboarded,
    segments,
    isAuthenticated,
    router.replace,
  ]);

  return ready;
}
