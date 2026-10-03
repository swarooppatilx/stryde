import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Card } from '@/components/card';
import { GoalRow } from '@/components/goal-row';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useGoals } from '@/hooks/useGoals';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Activity } from '@/types';
import type { UnitSystem } from '@/utils/format';
import { goalStanding } from '@/utils/goals';

interface Props {
  activities: readonly Activity[];
  units: UnitSystem;
}

/** The athlete's goals on the You tab, each with its progress; a full ring says "Goal reached". */
export function GoalsCard({ activities, units }: Props) {
  const router = useRouter();
  const goals = useGoals();
  const weekStartsOn = useSettingsStore((s) => s.weekStartsOn);
  const now = new Date();
  const open = () => router.push('/goals');

  return (
    <Card style={styles.card}>
      <ThemedText type="sectionTitle">Goals</ThemedText>
      {goals.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Pick a distance, time, elevation or activity count to aim for each week, month or year.
        </ThemedText>
      ) : (
        goals.map((goal) => (
          <GoalRow
            key={goal.id}
            goal={goal}
            standing={goalStanding(goal, activities, now, weekStartsOn)}
            units={units}
            onPress={open}
          />
        ))
      )}
      <Tappable onPress={open} accessibilityRole="button" accessibilityLabel="Manage goals">
        <ThemedText type="smallBold" themeColor="accentText">
          {goals.length === 0 ? 'Set a goal' : 'Manage goals'}
        </ThemedText>
      </Tappable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
});
