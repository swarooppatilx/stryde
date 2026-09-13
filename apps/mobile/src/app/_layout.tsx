import { PrivyProvider } from '@privy-io/expo';
import { SmartWalletsProvider } from '@privy-io/expo/smart-wallets';
import { setChainMode, setIpfsConfig } from '@repo/shared';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { Chain } from 'viem';
import { baseSepolia, sepolia } from 'viem/chains';
import { AlertHost } from '@/components/alert-host';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppErrorBoundary, AppErrorFallback } from '@/components/error-boundary';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastHost } from '@/components/toast-host';
import { ENV } from '@/constants/config';
import { useChainSync } from '@/hooks/useChainSync';
import { usePrivyMetadataSync } from '@/hooks/usePrivyMetadataSync';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { startRelayQueue } from '@/services/relayQueue';
import { useSocialStore } from '@/stores/socialStore';

// Privy's default supportedChains list puts mainnet first, and "the [embedded]
// wallet will automatically default to the first supplied supportedChain" —
// without this, the embedded wallet stays on mainnet regardless of our own
// CHAIN_MODE, and every write silently fails with a chain-mismatch error the
// moment viem notices the wallet's actual chain doesn't match the tx target.
// Local mode never touches Privy's wallet (see useViemWallet), so the value
// here is inconsequential there — sepolia is just a harmless default.
const PRIVY_SUPPORTED_CHAINS: [Chain, ...Chain[]] =
  ENV.CHAIN_MODE === 'base-sepolia' ? [baseSepolia] : [sepolia];

SplashScreen.preventAutoHideAsync();
setChainMode(ENV.CHAIN_MODE);
// packages/shared has no env config of its own — inject the API base URL/key
// it needs to upload activity/profile metadata to IPFS via our relay API.
setIpfsConfig({ apiUrl: ENV.API_URL, apiKey: ENV.API_KEY });
startRelayQueue();

// Privy's own init fetch (getAppConfig) has no timeout in the SDK — if the
// underlying React Native fetch() promise never settles (a known class of RN
// networking bug, more likely on a device that's mid network transition),
// `isReady` never flips and the app would otherwise hang on a blank screen
// forever with no error and no way to recover. This bounds that wait.
const PRIVY_INIT_TIMEOUT_MS = 10_000;

function RootLayoutNav({ onSlowInitRetry }: { onSlowInitRetry: () => void }) {
  const ready = useProtectedRoute();
  const syncing = useChainSync();
  usePrivyMetadataSync();
  const fetchUsers = useSocialStore((s) => s.fetchUsers);
  const fetchActivities = useSocialStore((s) => s.fetchActivities);
  const [slowInit, setSlowInit] = useState(false);
  // @ant-design/react-native's List.Item arrow glyph (and other icon-font
  // usages) render as tofu boxes unless these are registered — the package
  // ships the fonts but never wires them into expo-font itself.
  const [iconFontsLoaded] = useFonts({
    antoutline: require('@ant-design/icons-react-native/fonts/antoutline.ttf'),
    antfill: require('@ant-design/icons-react-native/fonts/antfill.ttf'),
  });

  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setSlowInit(true), PRIVY_INIT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    if (!syncing) {
      fetchUsers();
      fetchActivities();
    }
  }, [syncing, fetchUsers, fetchActivities]);

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

  if (!ready || syncing || !iconFontsLoaded) {
    // Render nothing until the auth guard has decided the first route so the
    // main UI never flashes before the login/onboarding redirect.
    return <AnimatedSplashOverlay />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="registering" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="activity-summary" />
      <Stack.Screen name="create-activity" />
      <Stack.Screen name="profile-edit" />
      <Stack.Screen name="club-detail" />
      <Stack.Screen name="create-club" />
      <Stack.Screen name="create-event" />
      <Stack.Screen name="event-detail" />
      <Stack.Screen name="leaderboard" />
      <Stack.Screen name="create-challenge" />
      <Stack.Screen name="challenge-detail" />
      <Stack.Screen name="search" />
      <Stack.Screen name="user-profile" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="verify" />
    </Stack>
  );
}

export default function RootLayout() {
  // Bumping this fully remounts PrivyProvider (and everything below it),
  // discarding whatever hung fetch/state it was stuck in — a plain state
  // reset wouldn't do that, since the stuck promise lives inside Privy's
  // client instance, not in our component state.
  const [privyInstanceKey, setPrivyInstanceKey] = useState(0);
  const retryPrivyInit = useCallback(() => setPrivyInstanceKey((k) => k + 1), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PrivyProvider
        key={privyInstanceKey}
        appId={ENV.PRIVY_APP_ID}
        clientId={ENV.PRIVY_CLIENT_ID}
        supportedChains={PRIVY_SUPPORTED_CHAINS}
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
            <AppErrorBoundary>
              <RootLayoutNav onSlowInitRetry={retryPrivyInit} />
              <ToastHost />
              <AlertHost />
            </AppErrorBoundary>
          </ThemeProvider>
        </SmartWalletsProvider>
      </PrivyProvider>
    </GestureHandlerRootView>
  );
}
