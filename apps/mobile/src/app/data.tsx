import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ChipRow } from '@/components/filter-chips';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useDeleteLocalData } from '@/hooks/useDeleteLocalData';
import { backUpMyData, restoreFromBackup } from '@/services/backupMyData';
import { countActivitiesInRange, exportActivitiesZip, exportMyData } from '@/services/exportMyData';
import { EXPORT_RANGE_OPTIONS, type ExportRange } from '@/utils/bulkExport';
import { logger } from '@/utils/logger';
import { Toast } from '@/utils/toast';

export default function DataScreen() {
  const router = useRouter();
  const handleDeleteLocalData = useDeleteLocalData();
  const [range, setRange] = useState<ExportRange>('all');
  const [zipping, setZipping] = useState(false);

  const exportZip = async () => {
    if (zipping) return;
    if (countActivitiesInRange(range) === 0) {
      Toast.info('No activities in that range');
      return;
    }
    setZipping(true);
    try {
      await exportActivitiesZip(range);
    } catch (e) {
      logger.warn('[Data] Activity export failed', e);
      Toast.fail("Couldn't export your activities", 2);
    } finally {
      setZipping(false);
    }
  };

  return (
    <SettingsScreen title="Data">
      <SettingsSection title="Your workouts and data">
        <SettingsRow
          icon="fitness-outline"
          title="Import workouts"
          subtitle="Bring in workouts from your phone's health app"
          onPress={() => router.push('/health-import')}
        />
        <SettingsRow
          icon="download-outline"
          title="Export my data"
          subtitle="Save a copy of your activities and profile"
          onPress={() =>
            exportMyData().catch((e) => {
              logger.warn('[Data] Export failed', e);
              Toast.fail("Couldn't export your data", 2);
            })
          }
        />
        <SettingsRow
          icon="map-outline"
          title="Offline maps"
          subtitle="Save map areas for places with no signal"
          onPress={() => router.push('/offline-maps')}
        />
        <SettingsRow
          icon="cloud-upload-outline"
          title="Back up my data"
          subtitle="Save a file with your private activities, notes, gear, goals and settings"
          onPress={() =>
            backUpMyData().catch((e) => {
              logger.warn('[Data] Backup failed', e);
              Toast.fail("Couldn't make the backup", 2);
            })
          }
        />
        <SettingsRow
          icon="cloud-download-outline"
          title="Restore from a backup"
          subtitle="Add what is in a backup file; what is on this phone is never overwritten"
          onPress={() =>
            restoreFromBackup().catch((e) => {
              logger.warn('[Data] Restore failed', e);
              Toast.fail("Couldn't restore the backup", 2);
            })
          }
        />
      </SettingsSection>

      <SettingsSection
        title="Export activities as files"
        footer="One ZIP with a GPX file for each activity that has a route, plus an index of all of them. Heart rate and cadence are in the TCX and FIT files you can export from a single activity."
      >
        <ChipRow options={EXPORT_RANGE_OPTIONS} value={range} onChange={setRange} />
        <SettingsRow
          icon="archive-outline"
          title={zipping ? 'Preparing your files...' : 'Export as ZIP'}
          subtitle="GPX files and an index, for the range above"
          onPress={() => void exportZip()}
        />
      </SettingsSection>

      <ThemedText
        type="eyebrow"
        themeColor="dangerText"
        accessibilityRole="header"
        style={{ marginTop: Spacing.four }}
      >
        DANGER ZONE
      </ThemedText>
      <SettingsSection footer="Removes everything this phone holds about your account, including changes not sent yet, and logs you out. You are told what would be lost before anything is deleted.">
        <SettingsRow
          icon="trash-outline"
          title="Delete data on this device"
          subtitle="Removes local data and logs you out"
          onPress={handleDeleteLocalData}
          danger
        />
      </SettingsSection>

      <SettingsSection footer="Removes what Stryde stored for your account, then wipes this phone and logs you out. Anything already saved to the public record cannot be erased. You can export first.">
        <SettingsRow
          icon="close-circle-outline"
          title="Delete my account"
          subtitle="Removes your account data from Stryde"
          onPress={() => router.push('/delete-account')}
          danger
        />
      </SettingsSection>
    </SettingsScreen>
  );
}
