import { Ionicons } from '@expo/vector-icons';
import { useLoginWithEmail } from '@privy-io/expo';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getActiveProfileId } from '@/backends/activeProfile';
import { PROFILES } from '@/backends/profiles';
import { BrandWordmark } from '@/components/brand';
import { AppButton } from '@/components/button';
import { DevLogin } from '@/components/dev-login';
import { OtpInput } from '@/components/otp-input';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeLoginFailure, isPlausibleEmail } from '@/utils/loginErrors';

const RESEND_SECONDS = 30;

/** Real sign-in on Live; a developer persona picker on the other profiles. */
export default function LoginScreen() {
  return PROFILES[getActiveProfileId()].auth === 'dev' ? <DevLogin /> : <PrivyLogin />;
}

function PrivyLogin() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [otpResetKey, setOtpResetKey] = useState(0);
  const [rejectedCodes, setRejectedCodes] = useState(0);
  const { sendCode, loginWithCode, state } = useLoginWithEmail();
  const router = useRouter();
  const theme = useTheme();
  const submittingRef = useRef(false);

  const isSending = state.status === 'sending-code';
  const isSubmitting = state.status === 'submitting-code';

  // One tick per second, and none once the wait is over.
  useEffect(() => {
    if (!codeSent || secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [codeSent, secondsLeft]);

  const handleLogin = useCallback(
    async (value: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setError(null);
      try {
        await loginWithCode({ code: value, email: email.trim() });
        router.replace('/');
      } catch (err) {
        setError(describeLoginFailure(err, 'verify'));
        setCode('');
        setRejectedCodes((n) => n + 1);
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
    if (!isPlausibleEmail(email)) {
      setError("That email address doesn't look right.");
      return;
    }
    setError(null);
    try {
      await sendCode({ email: email.trim() });
      setCodeSent(true);
      setSecondsLeft(RESEND_SECONDS);
    } catch (err) {
      setError(describeLoginFailure(err, 'send'));
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0) return;
    setCode('');
    setOtpResetKey((k) => k + 1);
    setError(null);
    setSecondsLeft(RESEND_SECONDS);
    try {
      await sendCode({ email: email.trim() });
    } catch (err) {
      setError(describeLoginFailure(err, 'send'));
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
            <Tappable
              style={[styles.backButton, { backgroundColor: theme.backgroundElement }]}
              onPress={() => {
                setCodeSent(false);
                setCode('');
                setOtpResetKey((k) => k + 1);
                setError(null);
              }}
              hitSlop={8}
              activeOpacity={0.7}
              accessibilityLabel="Go back to previous screen"
            >
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </Tappable>

            <View style={styles.otpContent}>
              <ThemedText type="display" style={styles.otpTitle}>
                We sent you a code
              </ThemedText>
              <ThemedText style={[styles.otpSubtitle, { color: theme.textSecondary }]}>
                Enter the 6-digit code we sent to{'\n'}
                <ThemedText style={[styles.otpEmail, { color: theme.text }]}>{email}</ThemedText>
              </ThemedText>

              <View style={styles.otpBox}>
                <OtpInput
                  key={otpResetKey}
                  length={6}
                  value={code}
                  onChange={(value) => {
                    setCode(value);
                    if (value.length === 6) void handleLogin(value);
                  }}
                  autoFocus
                  rejectedCount={rejectedCodes}
                />
              </View>

              {error ? (
                <ThemedText type="error" style={styles.error}>
                  {error}
                </ThemedText>
              ) : null}

              {isSubmitting ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Verifying...
                </ThemedText>
              ) : null}

              <Tappable
                onPress={handleResend}
                disabled={secondsLeft > 0}
                hitSlop={8}
                activeOpacity={0.7}
                accessibilityLabel="Resend verification code"
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
              </Tappable>
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
                contentFit="contain"
              />
              <BrandWordmark width={110} color={theme.text} />
            </View>

            <ThemedText type="display" style={styles.title}>
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
                accessibilityLabel="Email address"
                accessibilityHint="Enter your email to sign in"
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
