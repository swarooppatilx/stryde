import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ChipRow } from '@/components/filter-chips';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useDeleteLocalData } from '@/hooks/useDeleteLocalData';
import { type TKey, useT } from '@/i18n';
import { backUpMyData, restoreFromBackup } from '@/services/backupMyData';
import { countActivitiesInRange, exportActivitiesZip, exportMyData } from '@/services/exportMyData';
import type { ExportRange } from '@/utils/bulkExport';
import { logger } from '@/utils/logger';
import { Toast } from '@/utils/toast';

const RANGE_KEY: Record<ExportRange, TKey> = {
  all: 'data.rangeAll',
  '30d': 'data.range30d',
  year: 'data.rangeYear',
  lastYear: 'data.rangeLastYear',
};

const RANGES: readonly ExportRange[] = ['all', '30d', 'year', 'lastYear'];

export default function DataScreen() {
  const t = useT();
  const router = useRouter();
  const handleDeleteLocalData = useDeleteLocalData();
  const [range, setRange] = useState<ExportRange>('all');
  const [zipping, setZipping] = useState(false);

  const exportZip = async () => {
    if (zipping) return;
    if (countActivitiesInRange(range) === 0) {
      Toast.info(t('data.noActivities'));
      return;
    }
    setZipping(true);
    try {
      await exportActivitiesZip(range);
    } catch (e) {
      logger.warn('[Data] Activity export failed', e);
      Toast.fail(t('data.zipFailed'), 2);
    } finally {
      setZipping(false);
    }
  };

  return (
    <SettingsScreen title={t('data.title')}>
      <SettingsSection title={t('data.sectionYour')}>
        <SettingsRow
          icon="fitness-outline"
          title={t('data.importWorkouts')}
          subtitle={t('data.importWorkoutsHint')}
          onPress={() => router.push('/health-import')}
        />
        <SettingsRow
          icon="download-outline"
          title={t('data.export')}
          subtitle={t('data.exportHint')}
          onPress={() =>
            exportMyData().catch((e) => {
              logger.warn('[Data] Export failed', e);
              Toast.fail(t('data.exportFailed'), 2);
            })
          }
        />
        <SettingsRow
          icon="map-outline"
          title={t('data.offlineMaps')}
          subtitle={t('data.offlineMapsHint')}
          onPress={() => router.push('/offline-maps')}
        />
        <SettingsRow
          icon="cloud-upload-outline"
          title={t('data.backUp')}
          subtitle={t('data.backUpHint')}
          onPress={() =>
            backUpMyData().catch((e) => {
              logger.warn('[Data] Backup failed', e);
              Toast.fail(t('data.backUpFailed'), 2);
            })
          }
        />
        <SettingsRow
          icon="cloud-download-outline"
          title={t('data.restore')}
          subtitle={t('data.restoreHint')}
          onPress={() =>
            restoreFromBackup().catch((e) => {
              logger.warn('[Data] Restore failed', e);
              Toast.fail(t('data.restoreFailed'), 2);
            })
          }
        />
      </SettingsSection>

      <SettingsSection title={t('data.sectionZip')} footer={t('data.zipFooter')}>
        <ChipRow
          options={RANGES.map((value) => ({ value, label: t(RANGE_KEY[value]) }))}
          value={range}
          onChange={setRange}
        />
        <SettingsRow
          icon="archive-outline"
          title={zipping ? t('data.zipPreparing') : t('data.zipExport')}
          subtitle={t('data.zipHint')}
          onPress={() => void exportZip()}
        />
      </SettingsSection>

      <ThemedText
        type="eyebrow"
        themeColor="dangerText"
        accessibilityRole="header"
        style={{ marginTop: Spacing.four }}
      >
        {t('data.dangerZone')}
      </ThemedText>
      <SettingsSection footer={t('data.deleteLocalFooter')}>
        <SettingsRow
          icon="trash-outline"
          title={t('data.deleteLocal')}
          subtitle={t('data.deleteLocalHint')}
          onPress={handleDeleteLocalData}
          danger
        />
      </SettingsSection>

      <SettingsSection footer={t('data.deleteAccountFooter')}>
        <SettingsRow
          icon="close-circle-outline"
          title={t('data.deleteAccount')}
          subtitle={t('data.deleteAccountHint')}
          onPress={() => router.push('/delete-account')}
          danger
        />
      </SettingsSection>
    </SettingsScreen>
  );
}
