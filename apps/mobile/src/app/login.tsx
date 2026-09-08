import { Ionicons } from '@expo/vector-icons';
import { useLoginWithEmail } from '@privy-io/expo';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandWordmark } from '@/components/brand';
import { AppButton } from '@/components/button';
import { OtpInput } from '@/components/otp-input';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const RESEND_SECONDS = 30;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [otpResetKey, setOtpResetKey] = useState(0);
  const { sendCode, loginWithCode, state } = useLoginWithEmail();
  const router = useRouter();
  const theme = useTheme();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittingRef = useRef(false);

  const isSending = state.status === 'sending-code';
  const isSubmitting = state.status === 'submitting-code';

  useEffect(() => {
    if (!codeSent) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [codeSent]);

  const handleLogin = useCallback(
    async (value: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setError(null);
      try {
        await loginWithCode({ code: value, email: email.trim() });
        router.replace('/');
      } catch (_err) {
        setError('Invalid code. Please try again.');
        setOtpResetKey((k) => k + 1);
      } finally {
        submittingRef.current = false;
      }
    },
    [email, loginWithCode, router]
  );

  const handleSendCode = async () => {
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    setError(null);
    try {
      await sendCode({ email: email.trim() });
      setCodeSent(true);
      setSecondsLeft(RESEND_SECONDS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to send code: ${msg}`);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0) return;
    setOtpResetKey((k) => k + 1);
    setError(null);
    setSecondsLeft(RESEND_SECONDS);
    try {
      await sendCode({ email: email.trim() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to resend code: ${msg}`);
    }
  };

  if (codeSent) {
    return (
      <ThemedView type="background" style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.backgroundElement }]}
              onPress={() => {
                setCodeSent(false);
                setOtpResetKey((k) => k + 1);
                setError(null);
              }}
              hitSlop={8}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </TouchableOpacity>

            <View style={styles.otpContent}>
              <ThemedText type="title" style={styles.otpTitle}>
                We sent you a code
              </ThemedText>
              <ThemedText style={[styles.otpSubtitle, { color: theme.textSecondary }]}>
                Enter the 6-digit code we sent to{'\n'}
                <ThemedText style={[styles.otpEmail, { color: theme.text }]}>{email}</ThemedText>
              </ThemedText>

              <View style={styles.otpBox}>
                <OtpInput
                  key={otpResetKey}
                  otpCount={6}
                  enableAutoFocus
                  editable={!isSubmitting}
                  error={!!error}
                  onInputFinished={handleLogin}
                  animationVariant="fadeSlideUp"
                  inputWidth={44}
                  inputHeight={52}
                  inputBorderRadius={BorderRadius.md}
                  focusedColor={theme.text}
                  textStyle={{ color: theme.text }}
                  focusedBackgroundColor={theme.backgroundElement}
                  unfocusedBackgroundColor={theme.backgroundElement}
                  focusedBorderColor={theme.brand.primary}
                  unfocusedBorderColor={theme.border}
                  errorBackgroundColor={theme.backgroundElement}
                  errorBorderColor={Brand.danger}
                />
              </View>

              {error ? (
                <ThemedText type="error" style={styles.error}>
                  {error}
                </ThemedText>
              ) : null}

              {isSubmitting ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Verifying...
                </ThemedText>
              ) : null}

              <TouchableOpacity
                onPress={handleResend}
                disabled={secondsLeft > 0}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <ThemedText
                  type="small"
                  style={[
                    styles.resend,
                    { color: secondsLeft > 0 ? theme.textSecondary : theme.brand.primary },
                  ]}
                >
                  {secondsLeft > 0
                    ? `Resend code in 0:${String(secondsLeft).padStart(2, '0')}`
                    : 'Get a new code'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
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
            <View style={styles.wordmark}>
              <Image
                source={require('@/assets/images/stryde-emblem.png')}
                style={styles.emblem}
                resizeMode="contain"
              />
              <BrandWordmark width={110} color={theme.text} />
            </View>

            <ThemedText type="title" style={styles.title}>
              Get started
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              Enter your email and we'll send you a code.
            </ThemedText>

            <View style={styles.form}>
              <TextField
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                autoFocus
                returnKeyType="send"
                onSubmitEditing={handleSendCode}
                error={error}
              />

              <AppButton
                onPress={handleSendCode}
                loading={isSending}
                disabled={isSending}
                style={styles.continueButton}
              >
                Continue
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
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  wordmark: {
    alignItems: 'center',
    marginBottom: Spacing.four,
    flexDirection: 'row',
    gap: Spacing.two,
    marginHorizontal: 'auto',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.three,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.one,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.five,
  },
  form: {
    gap: Spacing.three,
  },
  continueButton: {
    borderRadius: BorderRadius.full,
    marginTop: Spacing.one,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.four,
    marginTop: Spacing.two,
  },
  otpContent: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.two,
  },
  otpTitle: {
    marginBottom: Spacing.one,
  },
  otpSubtitle: {
    lineHeight: 22,
    marginBottom: Spacing.four,
  },
  otpEmail: {
    fontWeight: '700',
  },
  otpBox: {
    marginBottom: Spacing.three,
  },
  error: {
    textAlign: 'left',
  },
  resend: {
    fontWeight: '600',
    marginTop: Spacing.two,
  },
  emblem: {
    width: 29,
    height: 40,
  },
});
