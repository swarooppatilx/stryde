import { getDocumentAsync } from 'expo-document-picker';
import Share from 'react-native-share';
import { getCurrentUserId } from '@/constants/config';
import { getPlatform } from '@/platform';
import { useActivityStore } from '@/stores/activityStore';
import { useGearStore } from '@/stores/gearStore';
import { useGoalsStore } from '@/stores/goalsStore';
import { useProfileStore } from '@/stores/profileStore';
import { Alert } from '@/utils/alert';
import {
  BACKUP_PROBLEMS,
  buildBackup,
  type MergeResult,
  mergeBackup,
  parseBackup,
  restoreSummary,
} from '@/utils/backupFile';
import { logger } from '@/utils/logger';
import { Toast } from '@/utils/toast';

const BACKUP_FILE = 'stryde-backup.json';
const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

/** Saves the private-only data to a file and opens the share sheet so it can be kept somewhere safe. */
export async function backUpMyData(): Promise<void> {
  const json = buildBackup({
    activities: useActivityStore.getState().activities,
    gear: useGearStore.getState().gear,
    goals: useGoalsStore.getState().goals,
    settings: useProfileStore.getState().settings,
    now: new Date(getPlatform().clock.now()),
  });
  const uri = getPlatform().files.writeCache(BACKUP_FILE, json);
  await Share.open({
    url: uri,
    type: 'application/json',
    filename: BACKUP_FILE,
    failOnCancel: false,
  });
}

function apply(merged: MergeResult): void {
  const activities = useActivityStore.getState();
  activities.setActivities([...merged.activities, ...activities.activities]);
  for (const [id, privateNote] of Object.entries(merged.notes)) {
    useActivityStore.getState().updateActivity(id, { privateNote });
  }
  useGearStore.setState((state) => ({ gear: [...state.gear, ...merged.gear] }));
  useGoalsStore.setState((state) => ({
    goals: [...state.goals, ...merged.goals],
    seeded: true,
  }));
  if (merged.counts.settings) useProfileStore.getState().updateSettings(merged.settings);
}

/** Lets the athlete pick a backup, says what it would add, and restores it once they agree. */
export async function restoreFromBackup(): Promise<void> {
  const picked = await getDocumentAsync({ type: '*/*', multiple: false });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return;
  if ((asset.size ?? 0) > MAX_BACKUP_BYTES) {
    Alert.alert('Backup too large', 'This file is too large to be a Stryde backup.');
    return;
  }
  let text: string;
  try {
    text = await getPlatform().files.readText(asset.uri);
  } catch (error) {
    logger.warn('[Backup] Could not read the file', error);
    Alert.alert('Could not open the file', 'Choose the backup file again.');
    return;
  }
  const parsed = parseBackup(text);
  if (!parsed.ok) {
    Alert.alert('Could not restore', BACKUP_PROBLEMS[parsed.reason]);
    return;
  }
  const merged = mergeBackup(
    parsed.backup,
    {
      activities: useActivityStore.getState().activities,
      gear: useGearStore.getState().gear,
      goals: useGoalsStore.getState().goals,
      settings: useProfileStore.getState().settings,
    },
    getCurrentUserId()
  );
  const { settings, ...numbers } = merged.counts;
  const nothing = !settings && Object.values(numbers).every((n) => n === 0);
  Alert.alert('Restore from this backup?', restoreSummary(merged.counts), [
    { text: 'Cancel', style: 'cancel' },
    ...(nothing
      ? []
      : [
          {
            text: 'Restore',
            onPress: () => {
              apply(merged);
              Toast.success('Backup restored', 2);
            },
          },
        ]),
  ]);
}
