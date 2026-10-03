import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLogout } from '@/hooks/useLogout';
import { useViemWallet } from '@/hooks/useViemWallet';
import { lookupUsername } from '@/services/profileLookup';
import { isRegisteredOnChain } from '@/services/registration';
import { useProfileStore } from '@/stores/profileStore';
import { getParsedError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export default function RegisteringScreen() {
  const { wallet, walletError, retry: retryWallet } = useViemWallet();
  const router = useRouter();
  // A wallet that cannot be reached would otherwise leave no way out but retrying.
  const confirmLogout = useLogout();
  const theme = useTheme();
  const [status, setStatus] = useState('Checking registration...');
  const [failed, setFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const setUsername = useProfileStore((s) => s.setUsername);
  const setWallet = useProfileStore((s) => s.setWallet);

  const handleRetry = () => {
    setFailed(false);
    setStatus('Checking registration...');
    setRetryToken((t) => t + 1);
    retryWallet();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: retryToken is a manual-retry trigger, not read in this callback
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (!wallet?.account) {
          // Never register against a half-provisioned identity: wait for the wallet, and offer
          // a retry if it could not be reached instead of spinning forever.
          if (walletError) {
            setStatus(walletError);
            setFailed(true);
          } else {
            setFailed(false);
            setStatus('Signing you in...');
          }
          return;
        }

        const address = wallet.account.address;

        const registered = await isRegisteredOnChain(address);
        if (registered) {
          if (!cancelled) {
            // No placeholder when the lookup fails: a made-up name would stick as the athlete's own.
            const username = await lookupUsername(address);
            if (username) setUsername(username);
            setWallet(address);
            router.replace('/(tabs)');
          }
          return;
        }

        // Not yet registered: profile-setup collects the username and submits registration.
        if (!cancelled) {
          router.replace('/profile-setup');
        }
      } catch (error) {
        logger.error('[Registering] Failed:', error);
        if (!cancelled) {
          setStatus(getParsedError(error));
          setFailed(true);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [wallet, walletError, setUsername, setWallet, router.replace, retryToken]);

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {failed ? (
            <Ionicons name="alert-circle-outline" size={32} color={theme.brand.danger} />
          ) : (
            <ActivityIndicator size="large" />
          )}
          <ThemedText type="headline" style={styles.title}>
            Setting up your profile
          </ThemedText>
          <ThemedText type="small" style={[styles.status, { color: theme.textSecondary }]}>
            {status}
          </ThemedText>
          {failed && (
            <Tappable
              onPress={confirmLogout}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Log out"
            >
              <ThemedText type="smallBold" style={{ color: theme.textSecondary }}>
                Log out
              </ThemedText>
            </Tappable>
          )}
          {failed && (
            <Tappable
              onPress={handleRetry}
              style={[styles.retryBtn, { backgroundColor: theme.brand.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Retry registration"
            >
              <ThemedText type="smallBold" style={{ color: Brand.white }}>
                Retry
              </ThemedText>
            </Tappable>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  title: { marginTop: Spacing.three, textAlign: 'center' },
  status: { textAlign: 'center' },
  retryBtn: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
  },
});
