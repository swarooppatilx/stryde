import { useEmbeddedEthereumWallet, usePrivy } from '@privy-io/expo';
import { services } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ENV } from '@/constants/config';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useViemWallet } from '@/hooks/useViemWallet';
import { updatePrivyMetadata } from '@/services/profileService';
import { useProfileStore } from '@/stores/profileStore';

export default function ProfileSetupScreen() {
  const { user } = usePrivy();
  const { wallets } = useEmbeddedEthereumWallet();
  const { wallet } = useViemWallet(ENV.CHAIN_MODE);
  const hasWallet = wallets && wallets.length > 0;
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!wallet) return;
      try {
        const registered = await services.profile.isRegistered(wallet.account.address);
        if (registered && !cancelled) {
          router.replace('/(tabs)');
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const suggestedUsername = useMemo(() => {
    if (!user) return '';
    const emailAccount = user.linked_accounts?.find((a) => a.type === 'email');
    if (emailAccount && 'address' in emailAccount) {
      return emailAccount.address.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
    }
    return '';
  }, [user]);

  const [username, setUsername] = useState(suggestedUsername);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setUsername: saveUsername, setWallet } = useProfileStore();

  const handleContinue = async () => {
    const trimmed = username.trim();
    if (trimmed.length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }
    if (trimmed.length > 20) {
      setError('Username must be 20 characters or less');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      saveUsername(trimmed);

      if (wallet && hasWallet) {
        try {
          const { txHash } = await services.profile.register(wallet, trimmed);
          console.log('[ProfileSetup] Registered onchain:', txHash);

          const embeddedWallet = wallets?.[0];
          if (embeddedWallet) {
            setWallet(embeddedWallet.address);
          }
        } catch (writeError) {
          console.warn('[ProfileSetup] Onchain registration failed:', writeError);
        }
      }

      if (user?.id) {
        updatePrivyMetadata(user.id, { username: trimmed }).catch((err) => {
          console.warn('[ProfileSetup] Failed to sync username to Privy', err);
        });
      }

      router.replace('/(tabs)');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checking) {
    return (
      <ThemedView type="background" style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <ActivityIndicator size="large" />
            <ThemedText type="headline" style={styles.title}>
              Checking profile
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.content}>
            <ThemedText type="title" style={styles.title}>
              {hasWallet ? 'Welcome back!' : 'Welcome!'}
            </ThemedText>
            <ThemedText numberOfLines={2} themeColor="textSecondary" style={styles.subtitle}>
              {hasWallet
                ? 'Set up your profile to continue'
                : 'Choose a username for your onchain identity'}
            </ThemedText>

            <View style={styles.form}>
              <TextField
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                error={error}
              />

              <AppButton onPress={handleContinue} style={styles.button} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : hasWallet ? (
                  'Continue'
                ) : (
                  'Get Started'
                )}
              </AppButton>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  title: {
    marginBottom: Spacing.two,
  },
  subtitle: {
    marginBottom: Spacing.six,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 400,
    gap: Spacing.three,
  },
  button: {
    borderRadius: BorderRadius.full,
    marginTop: Spacing.one,
  },
});
