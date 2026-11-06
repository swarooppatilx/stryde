import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { AppButton } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ZeroGReceipts } from '@/components/zero-g-receipts';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMaxHeartRate } from '@/hooks/useMaxHeartRate';
import { requestPlan } from '@/services/coachService';
import type { HumanAuth } from '@/services/humanPassService';
import { useActivityStore } from '@/stores/activityStore';
import { useCoachStore } from '@/stores/coachStore';
import { useGoalsStore } from '@/stores/goalsStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Alert } from '@/utils/alert';
import { coachFacts } from '@/utils/coachFacts';
import { localDay, recentHistory } from '@/utils/coachRun';
import { friendlyError } from '@/utils/friendlyError';
import { haptics } from '@/utils/haptics';
import { factsLine, PRIVACY_LINE, planHeadline, streakText } from '@/utils/planCardText';
import { isKept, keptDays, planStreak } from '@/utils/planKept';

/** Today's session, written on 0G from the last two weeks of runs and what the athlete said about them. */
export function CoachPlanCard({ auth }: { auth: HumanAuth | null }) {
  const theme = useTheme();
  const today = localDay(new Date());
  const saved = useCoachStore((s) => s.plans[today]);
  const plans = useCoachStore((s) => s.plans);
  const streak = planStreak(keptDays(plans), today);
  const [busy, setBusy] = useState(false);
  const maxHr = useMaxHeartRate();
  const restingHr = useProfileStore((s) => s.settings.restingHeartRate);
  const zoneFloors = useProfileStore((s) => s.settings.hrZoneFloors);

  const generate = async () => {
    if (!auth) return;
    setBusy(true);
    try {
      const { activities } = useActivityStore.getState();
      const { debriefs, reviews } = useCoachStore.getState();
      const profile = { maxHr, restingHr, zoneFloors };
      const history = recentHistory(activities, debriefs, Date.now(), profile);
      const facts = coachFacts(
        activities,
        {
          debriefs,
          reviews,
          goals: useGoalsStore.getState().goals,
          weekStartsOn: useSettingsStore.getState().weekStartsOn,
          profile,
        },
        new Date()
      );
      const result = await requestPlan(auth, history, today, facts);
      useCoachStore.getState().savePlan({ day: today, ...result, facts, createdAt: Date.now() });
      haptics.success();
    } catch (error) {
      Alert.alert("Today's plan", friendlyError(error, 'Try again in a moment.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.card}>
      <ThemedView style={styles.row}>
        <Ionicons name="sparkles" size={16} color={theme.brand.primary} />
        <ThemedText type="eyebrow" themeColor="textSecondary">
          Today's plan · runs on 0G
        </ThemedText>
      </ThemedView>

      {saved ? (
        <>
          <ThemedText type="sectionTitle">{saved.plan.title}</ThemedText>
          {planHeadline(saved.plan) ? (
            <ThemedText type="smallBold" style={{ color: theme.brand.primary }}>
              {planHeadline(saved.plan)}
            </ThemedText>
          ) : null}
          {factsLine(saved.facts) ? (
            <ThemedText type="caption" themeColor="textSecondary">
              {factsLine(saved.facts)}
            </ThemedText>
          ) : null}
          {saved.adjusted?.length ? (
            <ThemedView style={styles.row}>
              <Ionicons name="shield-checkmark-outline" size={14} color={theme.brand.primary} />
              <ThemedText type="caption" style={styles.flex}>
                Adjusted for safety: {saved.adjusted.join(' ')}
              </ThemedText>
            </ThemedView>
          ) : null}
          {saved.plan.summary ? <ThemedText type="small">{saved.plan.summary}</ThemedText> : null}
          <ThemedView style={styles.steps}>
            {saved.plan.steps.map((step, i) => (
              <ThemedView key={`${i}-${step.label}`} style={styles.step}>
                <ThemedText type="smallBold" style={{ color: theme.brand.primary }}>
                  {i + 1}
                </ThemedText>
                <ThemedView style={styles.flex}>
                  <ThemedText type="smallBold">{step.label}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {step.detail}
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            ))}
          </ThemedView>
          {saved.plan.why ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Why: {saved.plan.why}
            </ThemedText>
          ) : null}
          <ZeroGReceipts receipts={saved.receipts} />
          <ThemedText type="caption" themeColor="textSecondary">
            {PRIVACY_LINE}
          </ThemedText>
          {saved.committedAt === undefined ? (
            <>
              <AppButton
                onPress={() => {
                  useCoachStore.getState().commitPlan(today, Date.now());
                  haptics.success();
                }}
                icon={<Ionicons name="checkmark-circle-outline" size={18} color={Brand.white} />}
              >
                I'm doing this
              </AppButton>
              <AppButton
                size="small"
                variant="ghost"
                onPress={generate}
                loading={busy}
                disabled={busy || !auth}
              >
                Rethink today
              </AppButton>
            </>
          ) : (
            <ThemedView style={styles.row}>
              <Ionicons
                name={isKept(saved) ? 'checkmark-circle' : 'time-outline'}
                size={18}
                color={isKept(saved) ? Brand.verified : theme.textSecondary}
              />
              <ThemedView style={styles.flex}>
                <ThemedText type="smallBold">
                  {isKept(saved) ? 'Plan kept' : "You're on it. Go run."}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {isKept(saved) ? streakText(streak) : 'We check it off when your run is saved.'}
                </ThemedText>
              </ThemedView>
            </ThemedView>
          )}
        </>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Your coach reads your last two weeks and your voice debriefs, then writes one session
            for today. A new one every morning.
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {PRIVACY_LINE}
          </ThemedText>
          <AppButton
            onPress={generate}
            loading={busy}
            disabled={busy || !auth}
            icon={<Ionicons name="calendar-outline" size={18} color={Brand.white} />}
          >
            {busy ? 'Planning your day…' : "Plan today's session"}
          </AppButton>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  steps: { gap: Spacing.two },
  step: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
});
