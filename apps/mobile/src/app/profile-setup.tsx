import { Ionicons } from '@expo/vector-icons';
import { useEmbeddedEthereumWallet, usePrivy } from '@privy-io/expo';
import DateTimePicker from '@react-native-community/datetimepicker';
import { services } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/shallow';
import { AppButton } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ENV } from '@/constants/config';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useViemWallet } from '@/hooks/useViemWallet';
import { updatePrivyMetadata } from '@/services/profileService';
import { useProfileStore } from '@/stores/profileStore';
import type { Gender } from '@/types';

const STEPS = ['name', 'birthday', 'gender'] as const;
type Step = (typeof STEPS)[number];

const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
  { value: 'man', label: 'Man', icon: 'male' },
  { value: 'woman', label: 'Woman', icon: 'female' },
  { value: 'non_binary', label: 'Non-binary', icon: 'male-female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say', icon: 'person' },
];

export default function ProfileSetupScreen() {
  const { user } = usePrivy();
  const { wallets } = useEmbeddedEthereumWallet();
  const { wallet } = useViemWallet(ENV.CHAIN_MODE);
  const hasWallet = wallets && wallets.length > 0;
  const router = useRouter();
  const theme = useTheme();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>('name');

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!wallet?.account) return;
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
  }, [wallet, router.replace]);

  const suggestedUsername = useMemo(() => {
    if (!user) return '';
    const emailAccount = user.linked_accounts?.find((a) => a.type === 'email');
    if (emailAccount && 'address' in emailAccount) {
      return emailAccount.address.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
    }
    return '';
  }, [user]);

  const [username, setUsername] = useState(suggestedUsername);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [gender, setGender] = useState<Gender>('prefer_not_to_say');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    setUsername: saveUsername,
    setFirstName: saveFirstName,
    setLastName: saveLastName,
    setBirthday: saveBirthday,
    setGender: saveGender,
    setWallet,
    setProfileId,
  } = useProfileStore(
    useShallow((s) => ({
      setUsername: s.setUsername,
      setFirstName: s.setFirstName,
      setLastName: s.setLastName,
      setBirthday: s.setBirthday,
      setGender: s.setGender,
      setWallet: s.setWallet,
      setProfileId: s.setProfileId,
    }))
  );

  const canContinue = () => {
    if (step === 'name') return username.trim().length >= 2;
    if (step === 'birthday') return true;
    if (step === 'gender') return true;
    return false;
  };

  const handleNext = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1]);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) {
      setStep(STEPS[idx - 1]);
    }
  };

  const handleFinish = async () => {
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
      saveFirstName(firstName.trim());
      saveLastName(lastName.trim());
      saveGender(gender);
      if (birthday) {
        saveBirthday(birthday.toISOString().split('T')[0]);
      }

      if (wallet && hasWallet) {
        try {
          const { profileId, confirmed } = await services.profile.register(wallet, trimmed);

          const embeddedWallet = wallets?.[0];
          if (embeddedWallet) {
            setWallet(embeddedWallet.address);
          }
          if (confirmed) {
            setProfileId(profileId.toString());
          } else {
            console.warn('[ProfileSetup] Onchain registration did not confirm');
          }
        } catch (writeError) {
          console.warn('[ProfileSetup] Onchain registration failed:', writeError);
        }
      }

      if (user?.id) {
        updatePrivyMetadata(user.id, {
          username: trimmed,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }).catch((err) => {
          console.warn('[ProfileSetup] Failed to sync to Privy', err);
        });
      }

      router.replace('/(tabs)');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMaxDate = () => {
    const now = new Date();
    now.setFullYear(now.getFullYear() - 13);
    return now;
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
          {/* Header */}
          <ThemedView style={styles.header}>
            {step !== 'name' ? (
              <TouchableOpacity onPress={handleBack} hitSlop={8} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color={theme.brand.primary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.backBtn} />
            )}
            <ThemedText type="small" style={{ color: theme.brand.primary }}>
              {STEPS.indexOf(step) + 1}/{STEPS.length}
            </ThemedText>
            <View style={styles.backBtn} />
          </ThemedView>

          <View style={styles.content}>
            {step === 'name' && (
              <>
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
                    onChangeText={(t) => {
                      setUsername(t);
                      setError(null);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={20}
                    error={error}
                  />
                  <TextField
                    placeholder="First name"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCorrect={false}
                  />
                  <TextField
                    placeholder="Last name (optional)"
                    value={lastName}
                    onChangeText={setLastName}
                    autoCorrect={false}
                  />
                </View>
              </>
            )}

            {step === 'birthday' && (
              <>
                <ThemedText type="title" style={styles.title}>
                  When's your birthday?
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                  This helps us personalize your experience
                </ThemedText>

                <TouchableOpacity
                  style={[
                    styles.dateButton,
                    {
                      backgroundColor: `${theme.brand.primary}10`,
                      borderColor: theme.brand.primary,
                    },
                  ]}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <ThemedText
                    style={{
                      color: birthday ? theme.brand.primary : `${theme.brand.primary}80`,
                      fontSize: 16,
                    }}
                  >
                    {birthday
                      ? birthday.toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Select your birthday'}
                  </ThemedText>
                  <Ionicons name="calendar-outline" size={20} color={theme.brand.primary} />
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={birthday || getMaxDate()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_, selectedDate) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (selectedDate) setBirthday(selectedDate);
                    }}
                    maximumDate={getMaxDate()}
                    minimumDate={new Date(1920, 0, 1)}
                  />
                )}
              </>
            )}

            {step === 'gender' && (
              <>
                <ThemedText type="title" style={styles.title}>
                  What's your gender?
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                  This helps with leaderboards and insights
                </ThemedText>

                <View style={styles.genderGrid}>
                  {GENDER_OPTIONS.map((option) => {
                    const selected = gender === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.genderCard,
                          {
                            backgroundColor: selected
                              ? theme.brand.primary
                              : `${theme.brand.primary}10`,
                            borderColor: selected
                              ? theme.brand.primary
                              : `${theme.brand.primary}30`,
                          },
                        ]}
                        onPress={() => setGender(option.value)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={option.icon as keyof typeof Ionicons.glyphMap}
                          size={20}
                          color={selected ? Brand.white : theme.brand.primary}
                        />
                        <ThemedText
                          style={{
                            color: selected ? Brand.white : theme.brand.primary,
                            fontWeight: '600',
                            fontSize: 14,
                          }}
                        >
                          {option.label}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          <View style={styles.footer}>
            <AppButton
              onPress={handleNext}
              style={styles.button}
              disabled={!canContinue() || isSubmitting}
            >
              {isSubmitting
                ? 'Please wait...'
                : step === 'gender'
                  ? hasWallet
                    ? 'Continue'
                    : 'Get Started'
                  : 'Next'}
            </AppButton>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  title: { marginBottom: Spacing.two, textAlign: 'center' },
  subtitle: { marginBottom: Spacing.six, textAlign: 'center', paddingHorizontal: Spacing.four },
  form: { width: '100%', maxWidth: 400, gap: Spacing.three },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    width: '100%',
    maxWidth: 400,
  },
  genderGrid: { gap: Spacing.two, width: '100%', maxWidth: 400 },
  genderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  button: {
    borderRadius: BorderRadius.full,
    marginTop: Spacing.one,
  },
});
