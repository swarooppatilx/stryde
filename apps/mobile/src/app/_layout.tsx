import { PrivyProvider } from '@privy-io/expo';
import { setChainMode, setLocalRpcUrl } from '@repo/shared';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ThemeProvider } from '@/components/theme-provider';
import { ENV, getLocalRpcUrl } from '@/constants/config';
import { usePrivyMetadataSync } from '@/hooks/usePrivyMetadataSync';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { ensureLocalWalletFunded } from '@/utils/anvilFaucet';

SplashScreen.preventAutoHideAsync();
setChainMode(ENV.CHAIN_MODE);

if (ENV.CHAIN_MODE === 'local') {
  setLocalRpcUrl(getLocalRpcUrl());
  ensureLocalWalletFunded();
}

function RootLayoutNav() {
  const ready = useProtectedRoute();
  usePrivyMetadataSync();

  if (!ready) {
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
      <Stack.Screen name="search" />
      <Stack.Screen name="user-profile" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PrivyProvider
        appId={ENV.PRIVY_APP_ID}
        clientId={ENV.PRIVY_CLIENT_ID}
        config={{
          embedded: {
            ethereum: {
              createOnLogin: 'users-without-wallets',
            },
          },
        }}
      >
        <ThemeProvider>
          <RootLayoutNav />
        </ThemeProvider>
      </PrivyProvider>
    </GestureHandlerRootView>
  );
}
