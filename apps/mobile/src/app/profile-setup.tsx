import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/shallow';
import { BirthdayField } from '@/components/birthday-field';
import { AppButton } from '@/components/button';
import { GenderPicker } from '@/components/gender-picker';
import { SegmentedChoice } from '@/components/segmented-choice';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PERSON_NAME_MAX } from '@/constants/limits';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useViemWallet } from '@/hooks/useViemWallet';
import { useWorldVerification } from '@/hooks/useWorldVerification';
import { saveHeight, saveWeight } from '@/services/bodyProfile';
import { updatePrivyMetadata } from '@/services/profileService';
import { isRegisteredOnChain } from '@/services/registration';
import { useProfileStore } from '@/stores/profileStore';
import { useSetupStore } from '@/stores/setupStore';
import type { Gender } from '@/types';
import { birthdayStep, MIN_AGE } from '@/utils/age';
import { parseHeightCm } from '@/utils/body';
import { parseWeightKg, weightRangeText } from '@/utils/calories';
import { toCalendarDay } from '@/utils/dates';
import { getParsedError } from '@/utils/errors';
import type { UnitSystem } from '@/utils/format';
import { logger } from '@/utils/logger';
import { USERNAME_MAX_LENGTH, validateUsername } from '@/utils/username';

const STEPS = ['name', 'birthday', 'gender', 'body', 'verify'] as const;
const UNIT_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'Kilometres' },
  { value: 'imperial', label: 'Miles' },
];

type Step = (typeof STEPS)[number];

function submitLabel(isSubmitting: boolean, step: string): string {
  if (isSubmitting) return 'Creating your profile…';
  return step === 'verify' ? 'Continue' : 'Next';
}

export default function ProfileSetupScreen() {
  const { user } = useAuth();
  const { wallet, address } = useViemWallet();
  const accountId = useCurrentUserId();
  const beginSetup = useSetupStore((s) => s.begin);
  const router = useRouter();
  const theme = useTheme();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>('name');

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!wallet?.account) return;
      try {
        const registered = await isRegisteredOnChain(wallet.account.address);
        if (registered && !cancelled) {
          router.replace('/(tabs)');
        }
      } catch (error) {
        logger.warn('[profile-setup] Registration check failed', error);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [wallet, router.replace]);

  const suggestedUsername = useMemo(() => {
    if (!user?.email) return '';
    return (user.email.split('@')[0] ?? '').replace(/[^a-zA-Z0-9_]/g, '');
  }, [user]);

  const [username, setUsername] = useState(suggestedUsername);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [gender, setGender] = useState<Gender>('prefer_not_to_say');
  const [units, setUnits] = useState<UnitSystem>('metric');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
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
    updateSettings,
  } = useProfileStore(
    useShallow((s) => ({
      setUsername: s.setUsername,
      setFirstName: s.setFirstName,
      setLastName: s.setLastName,
      setBirthday: s.setBirthday,
      setGender: s.setGender,
      setWallet: s.setWallet,
      setProfileId: s.setProfileId,
      updateSettings: s.updateSettings,
    }))
  );

  const worldVerification = useWorldVerification();

  // The username and a birthday (13 or older) are required; gender and verification can be skipped past.
  const weightKg = parseWeightKg(weight, units);
  const weightInvalid = weight.trim() !== '' && weightKg === null;
  const heightCm = parseHeightCm(height, units);
  const heightInvalid = height.trim() !== '' && heightCm === null;
  const birthdayState = birthdayStep(birthday, new Date());
  const tooYoung = birthdayState === 'too-young';
  const canContinue = () => {
    if (step === 'name') return validateUsername(username).ok;
    if (step === 'body') return !weightInvalid && !heightInvalid;
    // No birthday, or one that says the athlete is under the minimum age, stops here.
    if (step === 'birthday') return birthdayState === 'ok';
    return true;
  };

  const handleNext = () => {
    // The keyboard from the previous field would otherwise stay up and crowd the next step.
    Keyboard.dismiss();
    const next = STEPS[STEPS.indexOf(step) + 1];
    if (next) {
      setStep(next);
    } else {
      handleFinish().catch((error) => logger.warn('[ProfileSetup] Finishing setup failed', error));
    }
  };

  const handleBack = () => {
    Keyboard.dismiss();
    const idx = STEPS.indexOf(step);
    const previous = idx > 0 ? STEPS[idx - 1] : undefined;
    if (previous) setStep(previous);
  };

  const handleFinish = async () => {
    const check = validateUsername(username);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    const trimmed = check.username;
    setError(null);
    setIsSubmitting(true);

    try {
      // A profile with no chain has nothing to register on: the profile is kept on this device.
      // The wallet state covers Privy and the Local profile's dev wallet alike; counting only Privy's
      // embedded wallets used to skip registration silently for a dev login on the local chain.
      if (wallet && !services.client.isChainOffline()) {
        try {
          const { profileId, confirmed } = await services.profile.register(wallet, trimmed);

          if (!confirmed) {
            setError("Setup didn't finish — please try again");
            return;
          }

          if (address) {
            setWallet(address);
          }
          setProfileId(profileId.toString());
        } catch (writeError) {
          logger.warn('[ProfileSetup] Onchain registration failed:', writeError);
          setError(getParsedError(writeError));
          return;
        }
      }

      saveUsername(trimmed);
      saveFirstName(firstName.trim());
      saveLastName(lastName.trim());
      saveGender(gender);
      updateSettings({ units });
      saveWeight(weightKg);
      saveHeight(heightCm);
      if (birthday) {
        saveBirthday(toCalendarDay(birthday));
      }

      if (user?.kind === 'privy') {
        updatePrivyMetadata(user.id, {
          username: trimmed,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }).catch((err) => {
          logger.warn('[ProfileSetup] Failed to sync to Privy', err);
        });
      }

      beginSetup(accountId);
      router.replace('/make-it-yours');
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
          <ThemedView style={styles.header}>
            {step === 'name' ? (
              <View style={styles.backBtn} />
            ) : (
              <Tappable
                onPress={handleBack}
                hitSlop={8}
                style={styles.backBtn}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons name="chevron-back" size={24} color={theme.brand.primary} />
              </Tappable>
            )}
            <View
              style={styles.progressRow}
              accessibilityRole="progressbar"
              accessibilityLabel={`Step ${STEPS.indexOf(step) + 1} of ${STEPS.length}`}
            >
              {STEPS.map((s, i) => (
                <View
                  key={s}
                  style={[
                    styles.progressSegment,
                    {
                      backgroundColor:
                        i <= STEPS.indexOf(step) ? theme.brand.primary : theme.border,
                    },
                  ]}
                />
              ))}
            </View>
            <View style={styles.backBtn} />
          </ThemedView>

          <View style={styles.content}>
            {step === 'name' && (
              <>
                <ThemedText type="display" style={styles.title}>
                  Welcome!
                </ThemedText>
                <ThemedText numberOfLines={2} themeColor="textSecondary" style={styles.subtitle}>
                  Choose your username to set up your profile
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
                    maxLength={USERNAME_MAX_LENGTH}
                    error={error}
                  />
                  <TextField
                    placeholder="First name"
                    maxLength={PERSON_NAME_MAX}
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCorrect={false}
                  />
                  <TextField
                    placeholder="Last name (optional)"
                    maxLength={PERSON_NAME_MAX}
                    value={lastName}
                    onChangeText={setLastName}
                    autoCorrect={false}
                  />
                </View>
              </>
            )}

            {step === 'birthday' && (
              <>
                <ThemedText type="display" style={styles.title}>
                  When's your birthday?
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                  We need it to make sure Stryde is right for you
                </ThemedText>

                <BirthdayField
                  value={birthday}
                  onChange={setBirthday}
                  tone="brand"
                  style={styles.fieldWidth}
                />
                {tooYoung ? (
                  <ThemedText
                    themeColor="dangerText"
                    style={styles.subtitle}
                    accessibilityLiveRegion="polite"
                  >
                    {`You need to be at least ${MIN_AGE} to use Stryde.`}
                  </ThemedText>
                ) : null}
              </>
            )}

            {step === 'gender' && (
              <>
                <ThemedText type="display" style={styles.title}>
                  What's your gender?
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                  This helps with leaderboards and insights
                </ThemedText>

                <GenderPicker
                  selected={gender}
                  onSelect={setGender}
                  tone="brand"
                  style={styles.fieldWidth}
                />
              </>
            )}

            {step === 'body' && (
              <>
                <ThemedText type="display" style={styles.title}>
                  Units and weight
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                  Weight and height are optional. They stay on this phone and are used for calories
                  and heart-rate estimates.
                </ThemedText>

                <View style={[styles.form, styles.fieldWidth]}>
                  <SegmentedChoice<UnitSystem>
                    options={UNIT_OPTIONS}
                    selected={units}
                    onSelect={setUnits}
                  />
                  <TextField
                    placeholder={`Weight in ${units === 'imperial' ? 'lb' : 'kg'} (optional)`}
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="decimal-pad"
                    error={weightInvalid ? `Enter a weight ${weightRangeText(units)}` : null}
                  />
                  <TextField
                    placeholder={
                      units === 'imperial'
                        ? `Height in ft and in, e.g. 5'10 (optional)`
                        : 'Height in cm (optional)'
                    }
                    value={height}
                    onChangeText={setHeight}
                    keyboardType="numbers-and-punctuation"
                    maxLength={7}
                    error={heightInvalid ? 'Enter a height between 100 and 250 cm' : null}
                  />
                </View>
              </>
            )}

            {step === 'verify' && (
              <>
                <Ionicons
                  name={worldVerification.isVerified ? 'checkmark-circle' : 'shield-checkmark'}
                  size={40}
                  color={theme.brand.primary}
                  style={{ marginBottom: Spacing.two }}
                />
                <ThemedText type="display" style={styles.title}>
                  {worldVerification.isVerified ? "You're verified" : 'Verify with World ID'}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                  {worldVerification.isVerified
                    ? 'World ID confirmed. Your profile shows a verified badge.'
                    : 'Optional: prove you’re a real person with World ID. Verified athletes get a badge and fairer leaderboards/territory claims.'}
                </ThemedText>

                {worldVerification.error && (
                  <ThemedText type="small" themeColor="dangerText" style={styles.stepError}>
                    {worldVerification.error.message}
                  </ThemedText>
                )}
                {/* Registration runs when this step finishes; its errors would
                    otherwise only render under the username field two steps back. */}
                {error && (
                  <ThemedText type="small" themeColor="dangerText" style={styles.stepError}>
                    {error}
                  </ThemedText>
                )}
              </>
            )}
          </View>

          <View style={styles.footer}>
            {/* Unverified: the one primary action is verifying; finishing
                without it is the secondary "Skip for now" link. Verified: the
                primary action finishes setup. */}
            {step === 'verify' && !worldVerification.isVerified ? (
              <AppButton
                onPress={worldVerification.startVerification}
                style={styles.button}
                loading={worldVerification.isBusy}
                disabled={
                  !worldVerification.isConfigured || worldVerification.isBusy || isSubmitting
                }
                icon={<Ionicons name="scan-outline" size={18} color={Brand.white} />}
              >
                Verify with World ID
              </AppButton>
            ) : (
              <AppButton
                onPress={handleNext}
                style={styles.button}
                disabled={!canContinue() || isSubmitting}
              >
                {submitLabel(isSubmitting, step)}
              </AppButton>
            )}
            {step === 'verify' && !worldVerification.isVerified && (
              <Tappable
                onPress={handleNext}
                hitSlop={8}
                disabled={isSubmitting}
                style={styles.skipLink}
              >
                <ThemedText type="small" themeColor="textSecondary">
                  {isSubmitting ? 'Creating your profile…' : 'Skip for now'}
                </ThemedText>
              </Tappable>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fieldWidth: { width: '100%', maxWidth: 400 },
  stepError: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
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
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.one,
    marginHorizontal: Spacing.two,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: BorderRadius.full,
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
  footer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  button: {
    borderRadius: BorderRadius.full,
    marginTop: Spacing.one,
  },
});
