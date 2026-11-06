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
import { useRefreshAthletePass, useWorldVerification } from '@/hooks/useWorldVerification';
import { isWorldIdConfigured } from '@/services/worldIdService';
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
    pass,
    status,
    error,
    activeKind,
    isConfigured,
    startVerification,
    startCheck,
    resetFlow,
    isBusy,
  } = useWorldVerification();
  useRefreshAthletePass();
  const needsStepUp = pass?.band === 'high' && !pass.steppedUp;
  // A badge from the older one-time check has no session, so it cannot sign runs: it still needs a pass.
  const hasPass = Boolean(pass) || (isVerified && !isWorldIdConfigured());

  useEffect(() => {
    // A high band stays here: the next step (Proof of Human) is on this screen.
    if (status === 'success' && !needsStepUp) {
      const timer = setTimeout(() => goBack(), 1200);
      return () => clearTimeout(timer);
    }
  }, [status, goBack, needsStepUp]);

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
          <ThemedText type="headline">Athlete Pass</ThemedText>
          <View style={styles.backBtn} />
        </ThemedView>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.hero}>
            <ThemedView style={[styles.heroIcon, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons
                name={hasPass ? 'checkmark-circle' : 'shield-checkmark'}
                size={32}
                color={hasPass ? Brand.verified : theme.brand.primary}
              />
            </ThemedView>
            <ThemedText type="headline" style={styles.heroTitle}>
              {hasPass ? 'Your Athlete Pass is active' : 'One human, one earning account'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.heroSubtitle}>
              {hasPass
                ? `Selfie Check confirmed on ${verifiedDate}. Your runs can earn STRD, and big ones are signed at the finish line.`
                : 'Running is free for everyone. Earning STRD needs an Athlete Pass: one World ID Selfie Check, once.'}
            </ThemedText>
          </ThemedView>

          {pass && (
            <Card style={styles.card}>
              <ThemedText type="sectionTitle">Your pass</ThemedText>
              <PassRow label="Sybil signal" value={BAND_LABEL[pass.band]} />
              <PassRow
                label="Finish-Line checks"
                value={
                  pass.band === 'low'
                    ? `Runs over ${(pass.finishLineMeters / 1000).toFixed(0)} km`
                    : 'Every earning run'
                }
              />
              <PassRow label="Runs signed by you" value={String(pass.presenceCount)} />
              {pass.steppedUp && <PassRow label="Proof of Human" value="Verified" />}
            </Card>
          )}

          {needsStepUp && (
            <Card style={{ ...styles.card, borderWidth: 1, borderColor: theme.brand.warning }}>
              <ThemedText type="sectionTitle">Earning is paused</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Your Selfie Check matched many other enrollments. That can be a lookalike, so it is
                not a verdict, but before paying out we ask for Proof of Human from the Orb. Your
                runs, records and territory all keep counting.
              </ThemedText>
              <AppButton
                onPress={() => startCheck('step_up')}
                loading={isBusy && activeKind === 'step_up'}
                disabled={isBusy}
              >
                Verify with Proof of Human
              </AppButton>
            </Card>
          )}

          {!hasPass && (
            <Card style={styles.card}>
              <ThemedText type="sectionTitle">Why Selfie Check, and not more?</ThemedText>
              <ThemedView style={styles.benefitRow}>
                <Ionicons name="happy-outline" size={18} color={theme.brand.primary} />
                <ThemedView style={styles.benefitCopy}>
                  <ThemedText type="smallBold">Enough to stop farms</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    A live face check stops bot farms and one person running ten accounts. The same
                    face signs your big runs, so a borrowed or rented phone cannot earn.
                  </ThemedText>
                </ThemedView>
              </ThemedView>
              <ThemedView style={styles.benefitRow}>
                <Ionicons name="globe-outline" size={18} color={theme.brand.primary} />
                <ThemedView style={styles.benefitCopy}>
                  <ThemedText type="smallBold">Open to every runner</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    No Orb visit and no passport: anyone with World App can do it in under a minute.
                    We only ask for the Orb when the risk signal says so.
                  </ThemedText>
                </ThemedView>
              </ThemedView>
              <ThemedView style={styles.benefitRow}>
                <Ionicons name="lock-closed-outline" size={18} color={theme.brand.primary} />
                <ThemedView style={styles.benefitCopy}>
                  <ThemedText type="smallBold">Nothing about you</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    We never need your name, age or nationality to pay for a run, so we never ask.
                    Stryde receives a zero-knowledge proof, not your face.
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
                {worldErrorText(error)}
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

          {hasPass ? (
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
              Get Athlete Pass with World ID
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

const BAND_LABEL = { low: 'Low', medium: 'Elevated', high: 'High' } as const;

function PassRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.passRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

/**
 * The check's own messages are written for people (see worldIdService); anything else (a raw network or
 * server error) goes through the usual cleaner. A plain `{code, message}` object would otherwise always
 * read "Something went wrong".
 */
function worldErrorText(error: { code: string; message: string }): string {
  return error.code === 'unknown' ? getParsedError(new Error(error.message)) : error.message;
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
  passRow: { flexDirection: 'row', justifyContent: 'space-between' },
  retryLink: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
