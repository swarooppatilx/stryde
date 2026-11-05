import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { Card } from '@/components/card';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DEV_TOOLS } from '@/constants/devTools';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGoBack } from '@/hooks/useGoBack';
import { useWorldVerification } from '@/hooks/useWorldVerification';
import { formatLongDate } from '@/utils/dates';
import { getParsedError } from '@/utils/errors';

const STATUS_MESSAGE: Record<string, string> = {
  opening: 'Opening World ID\u2026',
  polling: 'Complete Selfie Check in World ID, then return here.',
};

export default function VerifyScreen() {
  const goBack = useGoBack();
  const theme = useTheme();
  const {
    isVerified,
    verifiedAt,
    status,
    error,
    isConfigured,
    startVerification,
    resetFlow,
    isBusy,
  } = useWorldVerification();

  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => goBack(), 1200);
      return () => clearTimeout(timer);
    }
  }, [status, goBack]);

  const statusMessage = STATUS_MESSAGE[status] ?? null;

  const verifiedDate = verifiedAt && formatLongDate(verifiedAt);

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.topBar}>
          <Tappable
            onPress={goBack}
            style={[styles.backBtn, { backgroundColor: theme.backgroundElement }]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </Tappable>
          <ThemedText type="headline">Verification</ThemedText>
          <View style={styles.backBtn} />
        </ThemedView>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.hero}>
            <ThemedView style={[styles.heroIcon, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons
                name={isVerified ? 'checkmark-circle' : 'shield-checkmark'}
                size={32}
                color={isVerified ? Brand.verified : theme.brand.primary}
              />
            </ThemedView>
            <ThemedText type="headline" style={styles.heroTitle}>
              {isVerified ? 'You are verified' : 'Verify you are human'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.heroSubtitle}>
              {isVerified
                ? `Selfie Check confirmed on ${verifiedDate}. Your profile shows a verified badge.`
                : 'Stryde uses World ID Selfie Check to reduce fake accounts and protect territory claims.'}
            </ThemedText>
          </ThemedView>

          {!isVerified && (
            <Card style={styles.card}>
              <ThemedText type="sectionTitle">Why verify?</ThemedText>
              <ThemedView style={styles.benefitRow}>
                <Ionicons name="person-outline" size={18} color={theme.brand.primary} />
                <ThemedView style={styles.benefitCopy}>
                  <ThemedText type="smallBold">Real athlete badge</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    Show a verified check on your profile.
                  </ThemedText>
                </ThemedView>
              </ThemedView>
              <ThemedView style={styles.benefitRow}>
                <Ionicons name="map-outline" size={18} color={theme.brand.primary} />
                <ThemedView style={styles.benefitCopy}>
                  <ThemedText type="smallBold">Fair territory play</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    Selfie Check adds friction against bots and duplicate accounts.
                  </ThemedText>
                </ThemedView>
              </ThemedView>
              <ThemedView style={styles.benefitRow}>
                <Ionicons name="lock-closed-outline" size={18} color={theme.brand.primary} />
                <ThemedView style={styles.benefitCopy}>
                  <ThemedText type="smallBold">Privacy preserving</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    World ID proves you are a real person without sharing your identity.
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            </Card>
          )}

          {!isConfigured &&
            (DEV_TOOLS.enabled ? (
              <Card style={{ ...styles.card, borderWidth: 1, borderColor: theme.brand.warning }}>
                <ThemedText type="sectionTitle">Setup required</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Add your World app credentials to the mobile .env file:
                </ThemedText>
                <ThemedText type="caption" style={styles.mono}>
                  EXPO_PUBLIC_WORLD_APP_ID, EXPO_PUBLIC_WORLD_RP_ID, EXPO_PUBLIC_WORLD_ENVIRONMENT
                </ThemedText>
                <ThemedText
                  type="caption"
                  themeColor="textSecondary"
                  style={{ marginTop: Spacing.two }}
                >
                  The API server handles World ID request signing; nothing to run locally.
                </ThemedText>
              </Card>
            ) : (
              // Athletes can't fix a missing build setting, so they get a plain notice, not env var names.
              <Card style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  Verification isn't available right now. Try again after the next update.
                </ThemedText>
              </Card>
            ))}

          {statusMessage && (
            <Card style={styles.card}>
              <ThemedView style={styles.statusRow}>
                <Ionicons name="hourglass-outline" size={18} color={theme.brand.primary} />
                <ThemedText type="small">{statusMessage}</ThemedText>
              </ThemedView>
            </Card>
          )}

          {error && (
            <Card style={styles.card}>
              <ThemedText type="sectionTitle" style={{ color: theme.brand.danger }}>
                Verification failed
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {getParsedError(error)}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {VERIFY_RETRY_HINT}
              </ThemedText>
            </Card>
          )}

          {status === 'success' && (
            <Card style={styles.card}>
              <ThemedView style={styles.statusRow}>
                <Ionicons name="checkmark-circle" size={18} color={Brand.verified} />
                <ThemedText type="small">Verification complete. Returning to profile…</ThemedText>
              </ThemedView>
            </Card>
          )}

          {isVerified ? (
            <AppButton variant="secondary" onPress={goBack}>
              Back to profile
            </AppButton>
          ) : (
            <AppButton
              onPress={startVerification}
              loading={isBusy}
              disabled={!isConfigured || isBusy}
              icon={<Ionicons name="scan-outline" size={18} color={Brand.white} />}
            >
              Verify with World ID
            </AppButton>
          )}

          {error && (
            <Tappable onPress={resetFlow} style={styles.retryLink}>
              <ThemedText type="small" style={{ color: theme.accentText }}>
                Reset and try again
              </ThemedText>
            </Tappable>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const VERIFY_RETRY_HINT =
  'Check that the World App is installed and signed in, then use Reset and try again below.';

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  heroIcon: {
    width: 84,
    height: 84,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    textAlign: 'center',
  },
  heroSubtitle: {
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.two,
  },
  card: {
    gap: Spacing.three,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  benefitRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  benefitCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  mono: {
    fontFamily: 'monospace',
    marginTop: Spacing.two,
  },
  retryLink: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
