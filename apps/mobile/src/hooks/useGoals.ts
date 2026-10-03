import { useEffect, useState } from 'react';
import { useGoalsStore } from '@/stores/goalsStore';
import { useProfileStore } from '@/stores/profileStore';
import type { Goal } from '@/utils/goals';

/**
 * The athlete's goals. The first time, the weekly goals they already had are read in (the old
 * settings are left as they were), once both stores have loaded from the phone.
 */
export function useGoals(): Goal[] {
  const goals = useGoalsStore((s) => s.goals);
  const [loaded, setLoaded] = useState(
    useGoalsStore.persist.hasHydrated() && useProfileStore.persist.hasHydrated()
  );

  useEffect(() => {
    const check = () =>
      setLoaded(useGoalsStore.persist.hasHydrated() && useProfileStore.persist.hasHydrated());
    const offGoals = useGoalsStore.persist.onFinishHydration(check);
    const offProfile = useProfileStore.persist.onFinishHydration(check);
    check();
    return () => {
      offGoals();
      offProfile();
    };
  }, []);

  useEffect(() => {
    if (!loaded || useGoalsStore.getState().seeded) return;
    const { weeklyGoalDistance, weeklyGoalActivities, weeklyGoalTime } =
      useProfileStore.getState().settings;
    useGoalsStore.getState().seed({
      distance: weeklyGoalDistance,
      activities: weeklyGoalActivities,
      time: weeklyGoalTime,
    });
  }, [loaded]);

  return goals;
}
