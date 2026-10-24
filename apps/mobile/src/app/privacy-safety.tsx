import { useRouter } from 'expo-router';
import { AppSwitch } from '@/components/app-switch';
import { PrivacyPicker } from '@/components/privacy-picker';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useBlockStore } from '@/stores/blockStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { privateZonesSummary } from '@/utils/settingsSummary';

export default function PrivacySafetyScreen() {
  const router = useRouter();
  const defaultPrivacy = useSettingsStore((s) => s.defaultPrivacy);
  const setDefaultPrivacy = useSettingsStore((s) => s.setDefaultPrivacy);
  const hideRouteEnds = useSettingsStore((s) => s.hideRouteEnds);
  const setHideRouteEnds = useSettingsStore((s) => s.setHideRouteEnds);
  const zoneCount = useSettingsStore((s) => s.privacyZones.length);
  const hiddenCount = useBlockStore((s) => s.blocked.length + s.muted.length);

  return (
    <SettingsScreen title="Privacy and safety">
      <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
        DEFAULT VISIBILITY
      </ThemedText>
      <PrivacyPicker selected={defaultPrivacy} onSelect={setDefaultPrivacy} />
      <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: -Spacing.one }}>
        Who can see a new activity. You can still change it each time you save one.
      </ThemedText>

      <SettingsSection title="Routes">
        <SettingsRow
          icon="shield-checkmark-outline"
          title="Private places"
          subtitle={`${privateZonesSummary(zoneCount)} · hide routes near home or work`}
          onPress={() => router.push('/privacy-zones')}
        />
        <SettingsRow
          icon="eye-off-outline"
          title="Hide route start and end"
          subtitle={
            hideRouteEnds
              ? "On · others won't see at least the first and last 200 m"
              : 'Off · others see the whole route'
          }
          extra={
            <AppSwitch
              checked={hideRouteEnds}
              onChange={setHideRouteEnds}
              label="Hide the start and end of routes"
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="People">
        <SettingsRow
          icon="ban-outline"
          title="Blocked and muted"
          subtitle={
            hiddenCount === 0
              ? 'No one'
              : `${hiddenCount} ${hiddenCount === 1 ? 'person' : 'people'}`
          }
          onPress={() => router.push('/blocked')}
        />
      </SettingsSection>
    </SettingsScreen>
  );
}
