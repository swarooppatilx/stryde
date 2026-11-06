import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { Card } from '@/components/card';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useGoBack } from '@/hooks/useGoBack';
import { usePostRun } from '@/hooks/usePostRun';
import { useWorldVerification } from '@/hooks/useWorldVerification';
import { useActivityStore } from '@/stores/activityStore';
import type { RewardHold, WorldCheckKind } from '@/types/worldId';
import { activityStats } from '@/utils/activityStats';

const CHECK_FOR_HOLD: Record<RewardHold, WorldCheckKind> = {
  enroll_required: 'enroll',
  presence_required: 'presence',
  step_up_required: 'step_up',
};

const STEP_COPY: Record<RewardHold, { title: string; body: string; cta: string }> = {
  enroll_required: {
    title: 'Get your Athlete Pass',
    body: 'One World ID check in World App ties one real human to this earning account. You do it once.',
    cta: 'Get Athlete Pass with World ID',
  },
  presence_required: {
    title: 'Sign this run',
    body: 'A quick World ID check proves the human who holds your Athlete Pass is the one who ran it. The proof is bound to this run, and to nothing else.',
    cta: 'Sign with World ID',
  },
  step_up_required: {
    title: 'Step up to Proof of Human',
    body: 'Your Selfie Check matched many other enrollments. That is a risk signal, not a verdict, so we ask for the Orb-backed Proof of Human before paying out. Your runs are saved either way.',
    cta: 'Verify with Proof of Human',
  },
};

type Outcome = { kind: 'released' } | { kind: 'not_onchain'; message: string } | null;

/**
 * The trust moment: STRD is about to be paid for a run, so the server wants to know a real,
 * returning human ran it. Every path keeps the run; only the reward waits.
 */
export default function FinishLineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = useGoBack();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const activity = useActivityStore((s) => s.activities.find((a) => a.id === id));
  const { releaseReward } = usePostRun();
  const { pass, status, error, startCheck, resetFlow, isBusy, isConfigured } =
    useWorldVerification();
  const [releasing, setReleasing] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);

  if (!activity) {
    return (
      <ThemedView type="background" style={styles.container}>
        <SafeAreaView style={styles.center}>
          <ThemedText>This run is no longer on this device.</ThemedText>
          <AppButton variant="secondary" onPress={goBack}>
            Back
          </AppButton>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const hold = activity.rewardHold;
  const step = hold ? STEP_COPY[hold] : null;
  const stats = activityStats(activity, unitSystem).slice(0, 3);

  const runStep = async () => {
    if (!hold) return;
    resetFlow();
    setOutcome(null);
    const passed = await startCheck(CHECK_FOR_HOLD[hold], activity.activityHash);
    if (!passed) return;
    setReleasing(true);
    try {
      const release = await releaseReward(activity);
      if (release.status === 'released') setOutcome({ kind: 'released' });
      else if (release.status === 'failed') {
        setOutcome({
          kind: 'not_onchain',
          message:
            release.error instanceof Error
              ? release.error.message
              : 'The reward could not be sent yet.',
        });
      }
      // 'held' moves the activity to its next hold (e.g. enroll, then sign); the screen re-renders for it.
    } finally {
      setReleasing(false);
    }
  };

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
          <ThemedText type="headline">Finish line</ThemedText>
          <View style={styles.backBtn} />
        </ThemedView>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.hero}>
            <ThemedView style={[styles.heroIcon, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons
                name={outcome?.kind === 'released' || !hold ? 'checkmark-circle' : 'finger-print'}
                size={40}
                color={Brand.verified}
              />
            </ThemedView>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Signed by a human
            </ThemedText>
            <ThemedText type="headline" style={styles.center}>
              {activity.name}
            </ThemedText>
            {stats.length > 0 && (
              <View style={[styles.stats, { backgroundColor: theme.backgroundElement }]}>
                {stats.map((stat) => (
                  <View key={stat.label} style={styles.stat}>
                    <ThemedText type="headline">{stat.value}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {stat.label}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}
          </ThemedView>

          {outcome?.kind === 'released' || (!hold && !outcome) ? (
            <Card style={styles.card}>
              <ThemedText type="sectionTitle">Reward released</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                A real, returning human vouched for this run. STRD is on its way to your wallet.
              </ThemedText>
            </Card>
          ) : (
            step && (
              <Card style={styles.card}>
                <ThemedText type="sectionTitle">{step.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {step.body}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  Stryde learns only that the check passed. World never shares your face or name.
                </ThemedText>
              </Card>
            )
          )}

          {pass && (
            <Card style={styles.card}>
              <ThemedText type="sectionTitle">Your Athlete Pass</ThemedText>
              <PassRow label="Sybil signal" value={bandLabel(pass.band)} />
              <PassRow
                label="Finish-Line checks"
                value={
                  pass.finishLineMeters > 0
                    ? `Runs over ${(pass.finishLineMeters / 1000).toFixed(0)} km`
                    : 'Off'
                }
              />
              <PassRow label="Runs signed" value={String(pass.presenceCount)} />
            </Card>
          )}

          {status === 'polling' && (
            <Card style={styles.card}>
              <ThemedText type="small">
                Complete the check in World App, then come back here.
              </ThemedText>
            </Card>
          )}

          {error && (
            <Card style={{ ...styles.card, borderWidth: 1, borderColor: theme.brand.danger }}>
              <ThemedText type="sectionTitle" style={{ color: theme.brand.danger }}>
                {error.code === 'cancelled' ? 'Check dismissed' : 'World ID could not finish'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {error.message}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" style={styles.mono}>
                World ID code: {error.code}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Your run is saved and onchain. The reward stays held for you, and you can sign it
                later from the activity page.
              </ThemedText>
            </Card>
          )}

          {outcome?.kind === 'not_onchain' && (
            <Card style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                Check passed. {outcome.message} The reward will be sent on the next try.
              </ThemedText>
            </Card>
          )}

          {hold && outcome?.kind !== 'released' && step && (
            <AppButton
              onPress={runStep}
              loading={isBusy || releasing}
              disabled={!isConfigured || isBusy || releasing}
              icon={<Ionicons name="scan-outline" size={18} color={Brand.white} />}
            >
              {error ? 'Try again' : step.cta}
            </AppButton>
          )}

          <AppButton variant="secondary" onPress={goBack}>
            {hold && outcome?.kind !== 'released' ? 'Not now, keep the reward held' : 'Done'}
          </AppButton>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function bandLabel(band: 'low' | 'medium' | 'high'): string {
  if (band === 'low') return 'Low';
  if (band === 'medium') return 'Elevated';
  return 'High';
}

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

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: {
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
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
  hero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stats: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-around',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.three,
    marginTop: Spacing.two,
  },
  stat: { alignItems: 'center', gap: Spacing.half },
  card: { gap: Spacing.two },
  passRow: { flexDirection: 'row', justifyContent: 'space-between' },
  mono: { fontFamily: 'monospace' },
});
