import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/button';
import { Stepper } from '@/components/form-controls';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { SETUP_COPY } from '@/constants/copy';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useProfileStore } from '@/stores/profileStore';
import { useSetupStore } from '@/stores/setupStore';
import { formatDistance, METERS_PER_MILE } from '@/utils/format';
import { GOAL_PRESETS, type GoalPresetId, presetFor } from '@/utils/goalPresets';
import { haptics } from '@/utils/haptics';
import { WEEKLY_GOAL_STEPS } from '@/utils/weeklyGoals';

type Choice = GoalPresetId | 'custom';

/** Pick a weekly goal from three starting points, or set your own numbers. */
export function SetupGoalStep({ onNext }: { onNext: () => void }) {
  const theme = useTheme();
  const account = useCurrentUserId();
  const units = useProfileStore((s) => s.settings.units);
  const savedActivities = useProfileStore((s) => s.settings.weeklyGoalActivities);
  const savedDistance = useProfileStore((s) => s.settings.weeklyGoalDistance);
  const updateSettings = useProfileStore((s) => s.updateSettings);
  const markGoalChosen = useSetupStore((s) => s.markGoalChosen);

  const [choice, setChoice] = useState<Choice>(
    () => presetFor(savedActivities, savedDistance)?.id ?? 'custom'
  );
  const [activities, setActivities] = useState(savedActivities);
  const [distance, setDistance] = useState(savedDistance);

  const pick = (next: Choice) => {
    haptics.selection();
    setChoice(next);
    const preset = GOAL_PRESETS.find((p) => p.id === next);
    if (preset) {
      setActivities(preset.activities);
      setDistance(preset.distance);
    }
  };

  const next = () => {
    updateSettings({ weeklyGoalActivities: activities, weeklyGoalDistance: distance });
    markGoalChosen(account);
    onNext();
  };

  const card = (selected: boolean) => [
    styles.card,
    {
      backgroundColor: theme.backgroundElement,
      borderColor: selected ? theme.brand.primary : theme.border,
    },
  ];

  return (
    <>
      <View style={styles.list}>
        {GOAL_PRESETS.map((preset) => (
          <Tappable
            key={preset.id}
            onPress={() => pick(preset.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: choice === preset.id }}
            style={card(choice === preset.id)}
          >
            <ThemedText type="smallBold">{preset.title}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {`${preset.activities} activities, ${formatDistance(preset.distance, units)} a week`}
            </ThemedText>
          </Tappable>
        ))}
        <Tappable
          onPress={() => pick('custom')}
          accessibilityRole="radio"
          accessibilityState={{ selected: choice === 'custom' }}
          style={card(choice === 'custom')}
        >
          <ThemedText type="smallBold">{SETUP_COPY.goal.custom}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {SETUP_COPY.goal.customHint}
          </ThemedText>
          {choice === 'custom' && (
            <View style={styles.steppers}>
              <View style={styles.stepperRow}>
                <ThemedText type="small">{SETUP_COPY.goal.activities}</ThemedText>
                <Stepper
                  value={activities}
                  step={WEEKLY_GOAL_STEPS.activities.step}
                  min={WEEKLY_GOAL_STEPS.activities.min}
                  max={WEEKLY_GOAL_STEPS.activities.max}
                  format={String}
                  accessibilityLabel="activities goal"
                  onChange={setActivities}
                />
              </View>
              <View style={styles.stepperRow}>
                <ThemedText type="small">{SETUP_COPY.goal.distance}</ThemedText>
                <Stepper
                  value={distance}
                  step={units === 'imperial' ? METERS_PER_MILE : WEEKLY_GOAL_STEPS.distance.step}
                  min={WEEKLY_GOAL_STEPS.distance.min}
                  max={WEEKLY_GOAL_STEPS.distance.max}
                  format={(meters) => formatDistance(meters, units)}
                  accessibilityLabel="distance goal"
                  onChange={setDistance}
                />
              </View>
            </View>
          )}
        </Tappable>
      </View>
      <AppButton onPress={next}>{SETUP_COPY.continue}</AppButton>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  card: {
    gap: Spacing.half,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
  },
  steppers: { gap: Spacing.two, marginTop: Spacing.two },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
