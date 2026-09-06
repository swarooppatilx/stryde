import { usePrivy } from '@privy-io/expo';
import { services } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ENV } from '@/constants/config';
import { useViemWallet } from '@/hooks/useViemWallet';
import { useProfileStore } from '@/stores/profileStore';

export default function RegisteringScreen() {
  const { user } = usePrivy();
  const { wallet } = useViemWallet(ENV.CHAIN_MODE);
  const router = useRouter();
  const [status, setStatus] = useState('Checking registration...');
  const setUsername = useProfileStore((s) => s.setUsername);
  const setWallet = useProfileStore((s) => s.setWallet);
  const setProfileId = useProfileStore((s) => s.setProfileId);

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
          if (!cancelled) setStatus('Registration failed');
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
          setStatus('Registration failed');
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [wallet, user, setUsername, setWallet, setProfileId, router.replace]);

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <ActivityIndicator size="large" />
          <ThemedText type="headline" style={styles.title}>
            Setting up your profile
          </ThemedText>
          <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {status}
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  title: { marginTop: 16 },
});
