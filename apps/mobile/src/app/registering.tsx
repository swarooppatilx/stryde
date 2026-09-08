import { Ionicons } from '@expo/vector-icons';
import { usePrivy } from '@privy-io/expo';
import { services } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ENV } from '@/constants/config';
import { useTheme } from '@/hooks/use-theme';
import { useViemWallet } from '@/hooks/useViemWallet';
import { useProfileStore } from '@/stores/profileStore';
import { getParsedError } from '@/utils/errors';

export default function RegisteringScreen() {
  const { user } = usePrivy();
  const { wallet } = useViemWallet(ENV.CHAIN_MODE);
  const router = useRouter();
  const theme = useTheme();
  const [status, setStatus] = useState('Checking registration...');
  const [failed, setFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const setUsername = useProfileStore((s) => s.setUsername);
  const setWallet = useProfileStore((s) => s.setWallet);
  const setProfileId = useProfileStore((s) => s.setProfileId);

  const handleRetry = () => {
    setFailed(false);
    setStatus('Checking registration...');
    setRetryToken((t) => t + 1);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: retryToken is a manual-retry trigger, not read in this callback
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (!wallet?.account) {
          setStatus('Waiting for wallet...');
          return;
        }

        const address = wallet.account.address;

        const registered = await services.profile.isRegistered(address);
        if (registered) {
          if (!cancelled) {
            let username = 'registered';
            try {
              const users = await services.profile.getRegisteredUsers();
              const match = users.find((u) => u.wallet.toLowerCase() === address.toLowerCase());
              if (match?.username) {
                username = match.username;
              }
            } catch {
              // fallback to 'registered' if lookup fails
            }
            setUsername(username);
            setWallet(address);
            router.replace('/(tabs)');
          }
          return;
        }

        const emailAccount = user?.linked_accounts?.find((a) => a.type === 'email');
        const suggested =
          emailAccount && 'address' in emailAccount
            ? emailAccount.address.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '')
            : '';
        const username = suggested || `user_${address.slice(2, 8)}`;

        if (!cancelled) {
          setStatus(`Registering "${username}"...`);
        }

        const { profileId, confirmed } = await services.profile.register(wallet, username);

        if (!confirmed) {
          if (!cancelled) {
            setStatus("Setup didn't finish — please try again");
            setFailed(true);
          }
          return;
        }

        if (!cancelled) {
          setUsername(username);
          setWallet(address);
          setProfileId(profileId.toString());
          router.replace('/(tabs)');
        }
      } catch (error) {
        console.error('[Registering] Failed:', error);
        if (!cancelled) {
          setStatus(getParsedError(error));
          setFailed(true);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [wallet, user, setUsername, setWallet, setProfileId, router.replace, retryToken]);

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {failed ? (
            <Ionicons name="alert-circle-outline" size={40} color={theme.brand.danger} />
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
            <TouchableOpacity
              onPress={handleRetry}
              style={[styles.retryBtn, { backgroundColor: theme.brand.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Retry registration"
            >
              <ThemedText type="smallBold" style={{ color: '#fff' }}>
                Retry
              </ThemedText>
            </TouchableOpacity>
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
    gap: 16,
    paddingHorizontal: 24,
  },
  title: { marginTop: 16, textAlign: 'center' },
  status: { textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
  },
});
