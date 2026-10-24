import { List } from '@ant-design/react-native';
import { Stepper } from '@/components/form-controls';
import { ListIcon } from '@/components/list-icon';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { useProfileStore } from '@/stores/profileStore';
import { formatDistance, formatDuration, METERS_PER_MILE } from '@/utils/format';
import { DEFAULT_SETTINGS } from '@/utils/profile';
import { goalsChanged, WEEKLY_GOAL_STEPS } from '@/utils/weeklyGoals';

/** The three weekly goal steppers (distance, activities, time) with their heading. */
export function WeeklyGoalsSettings() {
  const units = useProfileStore((s) => s.settings.units);
  const weeklyGoalDistance = useProfileStore((s) => s.settings.weeklyGoalDistance);
  const weeklyGoalActivities = useProfileStore((s) => s.settings.weeklyGoalActivities);
  const weeklyGoalTime = useProfileStore((s) => s.settings.weeklyGoalTime);
  const updateSettings = useProfileStore((s) => s.updateSettings);
  const changed = goalsChanged(
    { weeklyGoalDistance, weeklyGoalActivities, weeklyGoalTime },
    DEFAULT_SETTINGS
  );

  return (
    <>
      <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
        WEEKLY GOALS
      </ThemedText>
      <List>
        <List.Item
          thumb={<ListIcon name="resize-outline" />}
          extra={
            <Stepper
              value={weeklyGoalDistance}
              // One whole unit per tap, in the athlete's own unit (the goal itself is kept in meters).
              step={units === 'imperial' ? METERS_PER_MILE : WEEKLY_GOAL_STEPS.distance.step}
              min={WEEKLY_GOAL_STEPS.distance.min}
              max={WEEKLY_GOAL_STEPS.distance.max}
              format={(meters) => formatDistance(meters, units)}
              accessibilityLabel="distance goal"
              onChange={(next) => updateSettings({ weeklyGoalDistance: next })}
            />
          }
        >
          Distance
        </List.Item>
        <List.Item
          thumb={<ListIcon name="footsteps-outline" />}
          extra={
            <Stepper
              value={weeklyGoalActivities}
              step={WEEKLY_GOAL_STEPS.activities.step}
              min={WEEKLY_GOAL_STEPS.activities.min}
              max={WEEKLY_GOAL_STEPS.activities.max}
              format={(value) => String(value)}
              accessibilityLabel="activities goal"
              onChange={(next) => updateSettings({ weeklyGoalActivities: next })}
            />
          }
        >
          Activities
        </List.Item>
        <List.Item
          thumb={<ListIcon name="time-outline" />}
          extra={
            <Stepper
              value={weeklyGoalTime}
              step={WEEKLY_GOAL_STEPS.time.step}
              min={WEEKLY_GOAL_STEPS.time.min}
              max={WEEKLY_GOAL_STEPS.time.max}
              format={formatDuration}
              accessibilityLabel="time goal"
              onChange={(next) => updateSettings({ weeklyGoalTime: next })}
            />
          }
        >
          Time
        </List.Item>
      </List>
      {changed ? (
        <Tappable
          onPress={() =>
            updateSettings({
              weeklyGoalDistance: DEFAULT_SETTINGS.weeklyGoalDistance,
              weeklyGoalActivities: DEFAULT_SETTINGS.weeklyGoalActivities,
              weeklyGoalTime: DEFAULT_SETTINGS.weeklyGoalTime,
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Reset weekly goals to the defaults"
          hitSlop={8}
        >
          <ThemedText type="small" themeColor="accentText">
            Reset to defaults
          </ThemedText>
        </Tappable>
      ) : null}
    </>
  );
}
