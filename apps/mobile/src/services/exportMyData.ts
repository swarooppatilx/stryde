import { getPlatform } from '@/platform';
import { useActivityStore } from '@/stores/activityStore';
import { useGearStore } from '@/stores/gearStore';
import { useProfileStore } from '@/stores/profileStore';
import { buildDataExport } from '@/utils/dataExport';
import { shareDataExport } from '@/utils/share';

/** Builds the export from what this phone holds and hands it to the share sheet. */
export async function exportMyData(): Promise<void> {
  const profile = useProfileStore.getState();
  const json = buildDataExport({
    profile,
    activities: useActivityStore.getState().activities,
    gear: useGearStore.getState().gear,
    now: new Date(getPlatform().clock.now()),
  });
  await shareDataExport(json);
}
