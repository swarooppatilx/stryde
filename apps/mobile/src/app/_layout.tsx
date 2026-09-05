import { PrivyProvider } from '@privy-io/expo';
import { setChainMode } from '@repo/shared';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ThemeProvider } from '@/components/theme-provider';
import { ENV } from '@/constants/config';
import { useChainSync } from '@/hooks/useChainSync';
import { usePrivyMetadataSync } from '@/hooks/usePrivyMetadataSync';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { useSocialStore } from '@/stores/socialStore';

SplashScreen.preventAutoHideAsync();
setChainMode(ENV.CHAIN_MODE);

function RootLayoutNav() {
  const ready = useProtectedRoute();
  const syncing = useChainSync();
  usePrivyMetadataSync();
  const fetchUsers = useSocialStore((s) => s.fetchUsers);
  const fetchActivities = useSocialStore((s) => s.fetchActivities);

  useEffect(() => {
    if (!syncing) {
      fetchUsers();
      fetchActivities();
    }
  }, [syncing, fetchUsers, fetchActivities]);

  if (!ready || syncing) {
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
      <Stack.Screen name="event-detail" />
      <Stack.Screen name="leaderboard" />
      <Stack.Screen name="create-challenge" />
      <Stack.Screen name="challenge-detail" />
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
