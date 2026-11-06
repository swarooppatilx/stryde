import { getPlatform } from '@/platform';
import { useActivityStore } from '@/stores/activityStore';
import { useGearStore } from '@/stores/gearStore';
import { useProfileStore } from '@/stores/profileStore';
import { activitiesInRange, buildBulkExport, type ExportRange } from '@/utils/bulkExport';
import { buildDataExport } from '@/utils/dataExport';
import { shareDataExport, shareZip } from '@/utils/share';
import { zipStore } from '@/utils/zipStore';

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

/** How many activities a ZIP would hold for a range, counting those listed without a route. */
export function countActivitiesInRange(range: ExportRange): number {
  const now = new Date(getPlatform().clock.now());
  return activitiesInRange(useActivityStore.getState().activities, range, now).length;
}

/** Zips a GPX per activity (plus an index) for the range and shares it; returns how many activities it covers. */
export async function exportActivitiesZip(range: ExportRange): Promise<number> {
  const now = new Date(getPlatform().clock.now());
  const chosen = activitiesInRange(useActivityStore.getState().activities, range, now);
  if (chosen.length === 0) return 0;
  const bulk = buildBulkExport(chosen, now, range);
  await shareZip('stryde-activities', zipStore(bulk.entries));
  return chosen.length;
}
