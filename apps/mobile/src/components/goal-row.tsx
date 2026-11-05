import { StyleSheet, View } from 'react-native';
import { ProgressRing } from '@/components/progress-ring';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { UnitSystem } from '@/utils/format';
import { formatGoalValue, type Goal, type GoalStanding, goalTitle } from '@/utils/goals';
import { countOf } from '@/utils/plural';

interface Props {
  goal: Goal;
  standing: GoalStanding;
  units: UnitSystem;
  onPress?(): void;
}

/** One goal: a ring, what it is, how far along, and either "Goal reached" or the days left. */
export function GoalRow({ goal, standing, units, onPress }: Props) {
  const theme = useTheme();
  const progress = `${formatGoalValue(goal.metric, standing.done, units)} of ${formatGoalValue(goal.metric, goal.target, units)}`;
  const status = standing.reached
    ? 'Goal reached'
    : `${countOf(standing.daysLeft, 'day', 'days')} left`;
  return (
    <Tappable
      onPress={onPress}
      disabled={!onPress}
      style={styles.row}
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={`${goalTitle(goal)}: ${progress}. ${status}`}
    >
      <ProgressRing ratio={standing.ratio} reached={standing.reached} />
      <View style={styles.text}>
        <ThemedText type="smallBold">{goalTitle(goal)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {progress}
        </ThemedText>
        <ThemedText
          type="caption"
          style={{ color: standing.reached ? theme.successText : theme.textSecondary }}
        >
          {status}
        </ThemedText>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  text: { flex: 1, gap: Spacing.half },
});
