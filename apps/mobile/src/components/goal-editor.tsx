import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/button';
import { ChipRow } from '@/components/filter-chips';
import { Stepper } from '@/components/form-controls';
import { SegmentedChoice } from '@/components/segmented-choice';
import { ThemedText } from '@/components/themed-text';
import { SPORT_TYPES } from '@/constants/activity';
import { Spacing } from '@/constants/theme';
import type { ActivityType } from '@/types';
import type { UnitSystem } from '@/utils/format';
import {
  formatGoalValue,
  GOAL_METRICS,
  GOAL_PERIODS,
  type Goal,
  type GoalMetric,
  type GoalPeriod,
  targetBounds,
} from '@/utils/goals';

type Draft = Omit<Goal, 'id'>;

interface Props {
  /** The goal being changed; a new one when absent. */
  goal?: Goal;
  units: UnitSystem;
  onSave(draft: Draft): void;
  onDelete?(): void;
  onCancel(): void;
}

const SPORT_OPTIONS: { value: ActivityType | 'all'; label: string }[] = [
  { value: 'all', label: 'All sports' },
  ...SPORT_TYPES.map((s) => ({ value: s.type, label: s.label })),
];

/** Metric, period, optional sport and target for one goal. */
export function GoalEditor({ goal, units, onSave, onDelete, onCancel }: Props) {
  const [metric, setMetric] = useState<GoalMetric>(goal?.metric ?? 'distance');
  const [period, setPeriod] = useState<GoalPeriod>(goal?.period ?? 'week');
  const [sport, setSport] = useState<ActivityType | 'all'>(goal?.sport ?? 'all');
  const [target, setTarget] = useState(
    goal?.target ?? targetBounds('distance', 'week', units).initial
  );
  const bounds = targetBounds(metric, period, units);

  const chooseMetric = (next: GoalMetric) => {
    setMetric(next);
    setTarget(targetBounds(next, period, units).initial);
  };
  const choosePeriod = (next: GoalPeriod) => {
    setPeriod(next);
    setTarget(targetBounds(metric, next, units).initial);
  };

  return (
    <View style={styles.form}>
      <ThemedText type="eyebrow" themeColor="textSecondary">
        MEASURE
      </ThemedText>
      <SegmentedChoice<GoalMetric>
        options={GOAL_METRICS}
        selected={metric}
        onSelect={chooseMetric}
        compact
      />
      <ThemedText type="eyebrow" themeColor="textSecondary">
        EVERY
      </ThemedText>
      <SegmentedChoice<GoalPeriod>
        options={GOAL_PERIODS}
        selected={period}
        onSelect={choosePeriod}
        fill
      />
      <ThemedText type="eyebrow" themeColor="textSecondary">
        SPORT
      </ThemedText>
      <ChipRow options={SPORT_OPTIONS} value={sport} onChange={setSport} />
      <ThemedText type="eyebrow" themeColor="textSecondary">
        TARGET
      </ThemedText>
      <View style={styles.target}>
        <Stepper
          value={target}
          step={bounds.step}
          min={bounds.min}
          max={bounds.max}
          format={(value) => formatGoalValue(metric, value, units)}
          accessibilityLabel="target"
          onChange={setTarget}
        />
      </View>
      <AppButton
        onPress={() =>
          onSave({ metric, period, target, sport: sport === 'all' ? undefined : sport })
        }
      >
        {goal ? 'Save goal' : 'Add goal'}
      </AppButton>
      {onDelete ? (
        <AppButton variant="danger" onPress={onDelete}>
          Delete goal
        </AppButton>
      ) : null}
      <AppButton variant="ghost" onPress={onCancel}>
        Cancel
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three },
  target: { alignItems: 'flex-start' },
});
