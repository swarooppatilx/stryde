import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';
import { DEV_TOOLS } from '@/constants/devTools';
import { useAuth } from '@/hooks/useAuth';
import { useLogout } from '@/hooks/useLogout';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { useWorldVerification } from '@/hooks/useWorldVerification';
import { useBodyStore } from '@/stores/bodyStore';
import { useGearStore } from '@/stores/gearStore';
import {
  enabledCount,
  NOTIFICATION_KINDS,
  useNotificationPrefsStore,
} from '@/stores/notificationPrefsStore';
import { useProfileStore } from '@/stores/profileStore';
import { ACCURACY_MODE_CONFIG, useSettingsStore } from '@/stores/settingsStore';
import {
  notificationsSummary,
  preferencesSummary,
  privacySummary,
  recordingSummary,
} from '@/utils/settingsSummary';

export default function SettingsListScreen() {
  const router = useRouter();
  const handleLogout = useLogout();
  const { user } = useAuth();
  const { isVerified } = useWorldVerification();
  const notificationsAllowed = useNotificationPermission();
  const prefs = useNotificationPrefsStore((s) => s.prefs);
  const username = useProfileStore((s) => s.username);
  const profileSettings = useProfileStore((s) => s.settings);
  const gearCount = useGearStore((s) => s.gear.length);
  const latestWeight = useBodyStore((s) => s.entries.at(-1)?.kg ?? null);
  const settings = useSettingsStore((s) => s);

  return (
    <SettingsScreen title="Settings">
      <SettingsSection title="Profile">
        <SettingsRow
          icon="person-outline"
          title="Edit profile"
          subtitle={username ? `@${username}` : 'Add your name and photo'}
          onPress={() => router.push('/profile-edit')}
        />
        <SettingsRow
          icon="body-outline"
          title="Body and heart rate"
          subtitle={latestWeight === null ? 'No weight saved' : `${latestWeight} kg`}
          onPress={() => router.push('/body')}
        />
        <SettingsRow
          icon="footsteps-outline"
          title="Gear"
          subtitle={
            gearCount === 0 ? 'None added' : `${gearCount} ${gearCount === 1 ? 'item' : 'items'}`
          }
          onPress={() => router.push('/gear')}
        />
      </SettingsSection>

      <SettingsSection title="App">
        <SettingsRow
          icon="options-outline"
          title="Preferences"
          subtitle={preferencesSummary({
            theme: profileSettings.theme,
            units: profileSettings.units,
            weekStartsOn: settings.weekStartsOn,
          })}
          onPress={() => router.push('/preferences')}
        />
        <SettingsRow
          icon="radio-button-on-outline"
          title="Recording"
          subtitle={recordingSummary({
            autoPause: settings.autoPause,
            autoPauseOnFoot: settings.autoPauseOnFoot,
            countdownSeconds: settings.countdownSeconds,
            accuracyLabel: ACCURACY_MODE_CONFIG[settings.accuracyMode].label,
          })}
          onPress={() => router.push('/recording-settings')}
        />
        <SettingsRow
          icon="lock-closed-outline"
          title="Privacy and safety"
          subtitle={privacySummary(settings.defaultPrivacy, settings.privacyZones.length)}
          onPress={() => router.push('/privacy-safety')}
        />
        <SettingsRow
          icon="notifications-outline"
          title="Notifications"
          subtitle={notificationsSummary(
            notificationsAllowed,
            enabledCount(prefs),
            NOTIFICATION_KINDS.length
          )}
          onPress={() => router.push('/notifications')}
        />
      </SettingsSection>

      <SettingsSection title="Account and data">
        <SettingsRow
          icon="person-circle-outline"
          title="Account"
          subtitle={`${user?.email ?? 'Signed in'} · World ID ${isVerified ? 'verified' : 'not verified'}`}
          onPress={() => router.push('/account')}
        />
        <SettingsRow
          icon="folder-open-outline"
          title="Data"
          subtitle="Import, export or delete your data"
          onPress={() => router.push('/data')}
        />
        <SettingsRow
          icon="help-circle-outline"
          title="Help and About"
          subtitle={`Version ${Constants.expoConfig?.version ?? '—'}`}
          onPress={() => router.push('/about')}
        />
      </SettingsSection>

      {DEV_TOOLS.enabled ? (
        <SettingsSection title="Developer">
          <SettingsRow
            icon="construct-outline"
            title="Developer tools"
            subtitle="Profiles, seed data and diagnostics"
            onPress={() => router.push('/dev-tools')}
          />
        </SettingsSection>
      ) : null}

      <SettingsSection>
        <SettingsRow
          icon="log-out-outline"
          title="Log out"
          subtitle={user?.email ?? undefined}
          onPress={handleLogout}
          danger
        />
      </SettingsSection>
    </SettingsScreen>
  );
}
