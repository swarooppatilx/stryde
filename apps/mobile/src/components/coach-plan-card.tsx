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
import { useActivityStore } from '@/stores/activityStore';
import { useCoachStore } from '@/stores/coachStore';
import { useGoalsStore } from '@/stores/goalsStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Alert } from '@/utils/alert';
import { coachFacts } from '@/utils/coachFacts';
import { localDay, recentHistory } from '@/utils/coachRun';
import { haptics } from '@/utils/haptics';

/** Today's session, written on 0G from the last two weeks of runs and what the athlete said about them. */
export function CoachPlanCard({ wallet }: { wallet: string | null | undefined }) {
  const theme = useTheme();
  const today = localDay(new Date());
  const saved = useCoachStore((s) => s.plans[today]);
  const [busy, setBusy] = useState(false);
  const maxHr = useMaxHeartRate();
  const restingHr = useProfileStore((s) => s.settings.restingHeartRate);
  const zoneFloors = useProfileStore((s) => s.settings.hrZoneFloors);

  const generate = async () => {
    if (!wallet) return;
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
      const result = await requestPlan(wallet, history, today, facts);
      useCoachStore.getState().savePlan({ day: today, ...result, createdAt: Date.now() });
      haptics.success();
    } catch (error) {
      Alert.alert(
        "Today's plan",
        error instanceof Error ? error.message : 'Try again in a moment.'
      );
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
          <AppButton
            size="small"
            variant="ghost"
            onPress={generate}
            loading={busy}
            disabled={busy || !wallet}
          >
            Rethink today
          </AppButton>
        </>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Your coach reads your last two weeks and your voice debriefs, then writes one session
            for today. A new one every morning.
          </ThemedText>
          <AppButton
            onPress={generate}
            loading={busy}
            disabled={busy || !wallet}
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
