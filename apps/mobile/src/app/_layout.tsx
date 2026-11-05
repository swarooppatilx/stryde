import { Ionicons } from '@expo/vector-icons';
import { PrivyProvider } from '@privy-io/expo';
import { SmartWalletsProvider } from '@privy-io/expo/smart-wallets';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { Chain } from 'viem';
import { baseSepolia, sepolia } from 'viem/chains';
import { markBootHealthy } from '@/backends/boot';
import { AlertHost } from '@/components/alert-host';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppErrorBoundary, AppErrorFallback } from '@/components/error-boundary';
import { PushPrimerSheet } from '@/components/push-primer-sheet';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastHost } from '@/components/toast-host';
import { WalletProvider } from '@/components/wallet-provider';
import { ENV, getChainMode } from '@/constants/config';
import { Motion } from '@/constants/motion';
import { useAccountOwnerGuard } from '@/hooks/useAccountOwnerGuard';
import { useActivitySync } from '@/hooks/useActivitySync';
import { useAuth } from '@/hooks/useAuth';
import { useChainSync } from '@/hooks/useChainSync';
import { useOutboxDrain } from '@/hooks/useOutbox';
import { useOutboxToasts } from '@/hooks/useOutboxToasts';
import { useRequeueOrphanedPosts } from '@/hooks/usePostActions';
import { usePrivyMetadataSync } from '@/hooks/usePrivyMetadataSync';
import { useProfileReady } from '@/hooks/useProfileReady';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { usePushNotifications, usePushPrimer } from '@/hooks/usePushNotifications';
import { useRecoveredRun } from '@/hooks/useRecoveredRun';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { getPlatform } from '@/platform';
import { useSocialStore } from '@/stores/socialStore';
import { logger } from '@/utils/logger';

// Privy's embedded wallet defaults to the first supported chain, which is mainnet unless overridden;
// without this every write fails with a chain mismatch. Local mode never uses Privy's wallet, so the
// value is irrelevant there.
function privyChains(): [Chain, ...Chain[]] {
  return getChainMode() === 'base-sepolia' ? [baseSepolia] : [sepolia];
}

SplashScreen.preventAutoHideAsync().catch((error) =>
  logger.warn('[Layout] Keeping the splash screen failed', error)
);

// Privy's init fetch (getAppConfig) has no timeout; if the React Native fetch never settles,
// `isReady` never flips and the app hangs on a blank screen. This bounds the wait.
const PRIVY_INIT_TIMEOUT_MS = 10_000;

function RootLayoutNav({ onSlowInitRetry }: { onSlowInitRetry: () => void }) {
  const ready = useProtectedRoute();
  useEffect(() => {
    if (ready) void markBootHealthy(getPlatform().storage);
  }, [ready]);
  const reduceMotion = useReduceMotion();
  const syncing = useChainSync();
  const { user } = useAuth();
  // Signing in as someone else without closing the app must load their feed, not keep the empty one.
  const userId = user?.id ?? null;
  useAccountOwnerGuard(userId);
  // After the chain's own activities are merged in, so one already there is not recorded twice.
  useActivitySync(ready && !syncing);
  useOutboxDrain(ready && !syncing);
  useOutboxToasts();
  useRequeueOrphanedPosts(ready && !syncing);
  useRecoveredRun(ready && !syncing);
  usePrivyMetadataSync();
  usePushNotifications(ready && !syncing, userId);
  const primer = usePushPrimer(ready && !syncing && userId !== null);
  const fetchUsers = useSocialStore((s) => s.fetchUsers);
  const fetchActivities = useSocialStore((s) => s.fetchActivities);
  const [slowInit, setSlowInit] = useState(false);
  // @ant-design/react-native ships its icon fonts but does not register them with expo-font;
  // unregistered, List.Item arrows and other glyphs render as boxes.
  // Ionicons is loaded here too, before the first screen: left to load on first use, its icons take
  // no space until the font arrives, so every row with one grows and shifts the layout a moment after launch.
  const [iconFontsLoaded] = useFonts({
    ...Ionicons.font,
    antoutline: require('@ant-design/icons-react-native/fonts/antoutline.ttf'),
    antfill: require('@ant-design/icons-react-native/fonts/antfill.ttf'),
  });

  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setSlowInit(true), PRIVY_INIT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a different signed-in user is the trigger
  useEffect(() => {
    if (!syncing) {
      void fetchUsers();
      void fetchActivities();
    }
  }, [syncing, userId, fetchUsers, fetchActivities]);

  if (!ready && slowInit) {
    return (
      <AppErrorFallback
        title="Taking longer than expected"
        subtitle="We couldn't reach the server. Check your connection and try again."
        buttonLabel="Retry"
        onRetry={onSlowInitRetry}
      />
    );
  }

  if (!ready || !iconFontsLoaded) {
    // Render nothing until the auth guard has chosen the first route, so the main UI never flashes before a redirect.
    return <AnimatedSplashOverlay />;
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: reduceMotion ? 'none' : 'slide_from_right',
          animationDuration: Motion.slide,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="registering" />
        <Stack.Screen name="profile-setup" />
        <Stack.Screen name="make-it-yours" options={{ gestureEnabled: false }} />
        <Stack.Screen name="activities/[id]" />
        <Stack.Screen name="post-upload" options={{ gestureEnabled: false }} />
        <Stack.Screen name="create-activity" />
        <Stack.Screen name="profile-edit" />
        <Stack.Screen name="clubs/[id]" />
        <Stack.Screen name="create-club" />
        <Stack.Screen name="create-event" />
        <Stack.Screen name="events/[id]" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="create-challenge" />
        <Stack.Screen name="challenges/[id]" />
        <Stack.Screen name="search" />
        <Stack.Screen name="inbox" />
        <Stack.Screen name="athletes/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="recording-settings" />
        <Stack.Screen name="preferences" />
        <Stack.Screen name="privacy-safety" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="account" />
        <Stack.Screen name="data" />
        <Stack.Screen name="about" />
        <Stack.Screen name="licences" />
        <Stack.Screen name="health-import" />
        <Stack.Screen name="import-activities" />
        <Stack.Screen name="gear" />
        <Stack.Screen name="goals" />
        <Stack.Screen name="activities/index" />
        <Stack.Screen name="athlete-stats" />
        <Stack.Screen name="year-in-sport" />
        <Stack.Screen name="follow-list" />
        <Stack.Screen name="blocked" />
        <Stack.Screen name="privacy-zones" />
        <Stack.Screen name="kudos" />
        <Stack.Screen name="badges/[id]" />
        <Stack.Screen name="create-post" />
        <Stack.Screen name="verify" />
        <Stack.Screen name="routes/[id]" />
        <Stack.Screen name="route-builder" />
        <Stack.Screen name="saved-routes" />
      </Stack>
      <PushPrimerSheet visible={primer.open} onAllow={primer.allow} onNotNow={primer.notNow} />
    </>
  );
}

// A build without the Privy IDs never initialises Privy, and the slow-init screen would blame the
// user's connection; say what is actually wrong immediately.
function MissingBuildConfig() {
  useEffect(() => {
    SplashScreen.hideAsync().catch((error) =>
      logger.warn('[Layout] Hiding the splash screen failed', error)
    );
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AppErrorFallback
          title="This build is misconfigured"
          subtitle="It was built without its Privy app ID, so sign-in can't start. Install a fresh build."
          buttonLabel="Close"
          onRetry={() => {}}
        />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  // The developer profile decides the chain and API, and it is read from disk: wait for it (the
  // splash screen stays up) before anything below talks to either.
  const profileReady = useProfileReady();
  // Bumping this remounts PrivyProvider and everything below it; the stuck promise lives in Privy's
  // client instance, so a plain state reset would not discard it.
  const [privyInstanceKey, setPrivyInstanceKey] = useState(0);
  const retryPrivyInit = () => setPrivyInstanceKey((k) => k + 1);

  if (!profileReady) return null;

  if (!ENV.PRIVY_APP_ID || !ENV.PRIVY_CLIENT_ID) {
    return <MissingBuildConfig />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PrivyProvider
        key={privyInstanceKey}
        appId={ENV.PRIVY_APP_ID}
        clientId={ENV.PRIVY_CLIENT_ID}
        supportedChains={privyChains()}
        config={{
          embedded: {
            ethereum: {
              createOnLogin: 'users-without-wallets',
            },
          },
        }}
      >
        <SmartWalletsProvider>
          <ThemeProvider>
            <WalletProvider>
              <AppErrorBoundary>
                <RootLayoutNav onSlowInitRetry={retryPrivyInit} />
                <ToastHost />
                <AlertHost />
              </AppErrorBoundary>
            </WalletProvider>
          </ThemeProvider>
        </SmartWalletsProvider>
      </PrivyProvider>
    </GestureHandlerRootView>
  );
}
