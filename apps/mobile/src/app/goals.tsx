import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { Card } from '@/components/card';
import { GoalEditor } from '@/components/goal-editor';
import { GoalRow } from '@/components/goal-row';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useGoals } from '@/hooks/useGoals';
import { useGoBack } from '@/hooks/useGoBack';
import { useActivityStore } from '@/stores/activityStore';
import { useGoalsStore } from '@/stores/goalsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { confirmDestructive } from '@/utils/confirmDestructive';
import { type Goal, goalStanding, goalTitle } from '@/utils/goals';

/** Everything the athlete is aiming for: add, change or remove a goal. */
export default function GoalsScreen() {
  const goBack = useGoBack();
  const theme = useTheme();
  const units = useUnitSystem();
  const goals = useGoals();
  const activities = useActivityStore((s) => s.activities);
  const weekStartsOn = useSettingsStore((s) => s.weekStartsOn);
  const addGoal = useGoalsStore((s) => s.addGoal);
  const updateGoal = useGoalsStore((s) => s.updateGoal);
  const removeGoal = useGoalsStore((s) => s.removeGoal);
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const now = new Date();

  const close = () => setEditing(null);
  const existing = editing && editing !== 'new' ? editing : undefined;
  let title = 'Goals';
  if (editing) title = existing ? 'Edit goal' : 'New goal';

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Tappable
            onPress={editing ? close : goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Close editor' : 'Back'}
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Tappable>
          <ThemedText type="sectionTitle">{title}</ThemedText>
          <View style={styles.spacer} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {editing ? (
            <GoalEditor
              key={existing?.id ?? 'new'}
              goal={existing}
              units={units}
              onCancel={close}
              onSave={(draft) => {
                if (existing) updateGoal(existing.id, draft);
                else addGoal(draft);
                close();
              }}
              onDelete={
                existing
                  ? () =>
                      confirmDestructive({
                        title: 'Delete this goal?',
                        message: `"${goalTitle(existing)}" will no longer show on your profile. Your activities are not affected.`,
                        confirmLabel: 'Delete',
                        onConfirm: () => {
                          removeGoal(existing.id);
                          close();
                        },
                      })
                  : undefined
              }
            />
          ) : (
            <>
              {goals.length === 0 ? (
                <ThemedText themeColor="textSecondary">
                  No goals yet. Add one to see your progress on your profile.
                </ThemedText>
              ) : (
                <Card style={styles.list}>
                  {goals.map((goal) => (
                    <GoalRow
                      key={goal.id}
                      goal={goal}
                      standing={goalStanding(goal, activities, now, weekStartsOn)}
                      units={units}
                      onPress={() => setEditing(goal)}
                    />
                  ))}
                </Card>
              )}
              <AppButton onPress={() => setEditing('new')}>Add a goal</AppButton>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  spacer: { width: 24 },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  list: { gap: Spacing.four },
});
