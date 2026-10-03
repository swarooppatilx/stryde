/** How the weekly goal steppers move. A goal can be small but never zero. Distance is in meters, time in ms. */
export const WEEKLY_GOAL_STEPS = {
  distance: { step: 1000, min: 1000, max: 100000 },
  activities: { step: 1, min: 1, max: 50 },
  time: { step: 300000, min: 300000, max: 36000000 },
} as const;

interface GoalValues {
  weeklyGoalDistance: number;
  weeklyGoalActivities: number;
  weeklyGoalTime: number;
}

/** Whether the athlete has changed any weekly goal from the defaults. */
export function goalsChanged(current: GoalValues, defaults: GoalValues): boolean {
  return (
    current.weeklyGoalDistance !== defaults.weeklyGoalDistance ||
    current.weeklyGoalActivities !== defaults.weeklyGoalActivities ||
    current.weeklyGoalTime !== defaults.weeklyGoalTime
  );
}
