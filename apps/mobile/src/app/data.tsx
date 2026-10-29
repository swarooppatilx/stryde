import { useRouter } from 'expo-router';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useDeleteLocalData } from '@/hooks/useDeleteLocalData';
import { exportMyData } from '@/services/exportMyData';
import { logger } from '@/utils/logger';
import { Toast } from '@/utils/toast';

export default function DataScreen() {
  const router = useRouter();
  const handleDeleteLocalData = useDeleteLocalData();

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
    </SettingsScreen>
  );
}
