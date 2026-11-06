import { getPlatform } from '@/platform';
import {
  activityInputFromWorkout,
  type HealthImportResult,
  importWorkouts,
} from '@/services/healthImport';
import type { PostRunInput } from '@/services/postRun';
import { useActivityStore } from '@/stores/activityStore';
import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';

/** One import from the phone's health data, saved like any other activity: on this device first. */
export async function runHealthImport(
  savePostRun: (input: PostRunInput) => Promise<unknown>
): Promise<HealthImportResult> {
  const { health, clock } = getPlatform();
  const outcome = await importWorkouts({
    health,
    now: () => clock.now(),
    state: {
      read: () => {
        const { watermark, imported } = useHealthStore.getState();
        return { watermark, imported };
      },
      write: (next) => useHealthStore.getState().write(next),
    },
    // A run recorded here that a watch recorded too is not imported again.
    existing: () => useActivityStore.getState().activities,
    save: async (workout) => {
      const { defaultPrivacy, hideRouteEnds, privacyZones } = useSettingsStore.getState();
      await savePostRun({
        ...activityInputFromWorkout(workout),
        privacy: defaultPrivacy,
        hideRouteEnds,
        privacyZones,
      });
    },
  });
  if (outcome.status === 'done') useHealthStore.getState().markImported(clock.now());
  return outcome;
}
