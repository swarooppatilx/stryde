import { Switch } from '@ant-design/react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';
import { DEV_TOOLS } from '@/constants/devTools';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import { useLogout } from '@/hooks/useLogout';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { useWorldVerification } from '@/hooks/useWorldVerification';
import { type TFunction, useT } from '@/i18n';
import {
  getHealthAvailability,
  openHealthSettings,
  requestHealthPermissions,
} from '@/services/healthService';
import { useBodyStore } from '@/stores/bodyStore';
import { useGearStore } from '@/stores/gearStore';
import {
  enabledCount,
  NOTIFICATION_KINDS,
  useNotificationPrefsStore,
} from '@/stores/notificationPrefsStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Alert } from '@/utils/alert';
import {
  notificationsSummary,
  preferencesSummary,
  privacySummary,
  recordingSummary,
} from '@/utils/settingsSummary';

const ACCURACY_KEY = {
  best: 'accuracy.best',
  balanced: 'accuracy.balanced',
  power: 'accuracy.lowPower',
} as const;

function HealthConnectAccessRow({ visible, t }: { visible: boolean; t: TFunction }) {
  if (!visible) return null;
  return (
    <SettingsRow
      icon="settings-outline"
      title={t('settings.manageHealthConnect')}
      onPress={openHealthSettings}
    />
  );
}

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
  const theme = useTheme();
  const t = useT();
  const isIos = Platform.OS === 'ios';

  const toggleHealthData = async (enabled: boolean) => {
    if (!enabled) {
      settings.setHealthData(false);
      return;
    }
    const availability = await getHealthAvailability();
    if (!availability.available) {
      Alert.alert(
        t('settings.healthUnavailableTitle'),
        availability.reason ?? t('settings.healthUnavailableBody')
      );
      return;
    }
    if (!(await requestHealthPermissions())) {
      Alert.alert(t('settings.permissionNeededTitle'), t('settings.permissionNeededBody'));
      return;
    }
    settings.setHealthData(true);
  };

  return (
    <SettingsScreen title={t('settings.title')}>
      <SettingsSection title={t('settings.sectionProfile')}>
        <SettingsRow
          icon="person-outline"
          title={t('settings.editProfile')}
          subtitle={username ? `@${username}` : t('settings.editProfileHint')}
          onPress={() => router.push('/profile-edit')}
        />
        <SettingsRow
          icon="body-outline"
          title={t('settings.body')}
          subtitle={latestWeight === null ? t('settings.bodyNone') : `${latestWeight} kg`}
          onPress={() => router.push('/body')}
        />
        <SettingsRow
          icon="footsteps-outline"
          title={t('settings.gear')}
          subtitle={
            gearCount === 0 ? t('settings.gearNone') : t('settings.gearCount', { count: gearCount })
          }
          onPress={() => router.push('/gear')}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionApp')}>
        <SettingsRow
          icon="options-outline"
          title={t('settings.preferences')}
          subtitle={preferencesSummary(
            {
              theme: profileSettings.theme,
              units: profileSettings.units,
              weekStartsOn: settings.weekStartsOn,
              language: settings.language,
            },
            t
          )}
          onPress={() => router.push('/preferences')}
        />
        <SettingsRow
          icon="radio-button-on-outline"
          title={t('settings.recording')}
          subtitle={recordingSummary(
            {
              autoPause: settings.autoPause,
              autoPauseOnFoot: settings.autoPauseOnFoot,
              countdownSeconds: settings.countdownSeconds,
              accuracyLabel: t(ACCURACY_KEY[settings.accuracyMode]),
            },
            t
          )}
          onPress={() => router.push('/recording-settings')}
        />
        <SettingsRow
          icon="lock-closed-outline"
          title={t('settings.privacy')}
          subtitle={privacySummary(settings.defaultPrivacy, settings.privacyZones.length, t)}
          onPress={() => router.push('/privacy-safety')}
        />
        <SettingsRow
          icon="notifications-outline"
          title={t('settings.notifications')}
          subtitle={notificationsSummary(
            notificationsAllowed,
            enabledCount(prefs),
            NOTIFICATION_KINDS.length,
            t
          )}
          onPress={() => router.push('/notifications')}
        />
      </SettingsSection>

      <SettingsSection
        title={t('settings.sectionWearables')}
        footer={t(isIos ? 'settings.footerIos' : 'settings.footerAndroid')}
      >
        <SettingsRow
          icon="heart-outline"
          title={t(isIos ? 'settings.heartRateIos' : 'settings.heartRateAndroid')}
          extra={
            <Switch
              checked={settings.healthData}
              onChange={toggleHealthData}
              color={theme.brand.primary}
            />
          }
        />
        <SettingsRow
          icon="radio-outline"
          title={t('settings.liveBeacon')}
          extra={
            <Switch
              checked={settings.liveBeacon}
              onChange={settings.setLiveBeacon}
              color={theme.brand.primary}
            />
          }
        />
        <SettingsRow
          icon="bug-outline"
          title={t('settings.verboseLog')}
          extra={
            <Switch
              checked={settings.verboseTrackingLog}
              onChange={settings.setVerboseTrackingLog}
              color={theme.brand.primary}
            />
          }
        />
        <SettingsRow
          icon="lock-closed-outline"
          title={t('settings.privateArchive')}
          extra={
            <Switch
              checked={settings.privateRoutes}
              onChange={settings.setPrivateRoutes}
              color={theme.brand.primary}
            />
          }
        />
        <HealthConnectAccessRow visible={settings.healthData && Platform.OS === 'android'} t={t} />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionPartner')}>
        <SettingsRow
          icon="sparkles-outline"
          title={t('settings.coach')}
          subtitle={t('settings.coachHint')}
          onPress={() => router.push('/coach')}
        />
        <SettingsRow
          icon="flag-outline"
          title={t('settings.segments')}
          subtitle={t('settings.segmentsHint')}
          onPress={() => router.push('/segments')}
        />
        <SettingsRow
          icon="swap-horizontal-outline"
          title={t('settings.cashOut')}
          subtitle={t('settings.cashOutHint')}
          onPress={() => router.push('/cash-out')}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionAccount')}>
        <SettingsRow
          icon="person-circle-outline"
          title={t('settings.account')}
          subtitle={t('settings.accountSubtitle', {
            who: user?.email ?? t('settings.signedIn'),
            state: t(isVerified ? 'settings.worldVerified' : 'settings.worldNotVerified'),
          })}
          onPress={() => router.push('/account')}
        />
        <SettingsRow
          icon="folder-open-outline"
          title={t('settings.data')}
          subtitle={t('settings.dataHint')}
          onPress={() => router.push('/data')}
        />
        <SettingsRow
          icon="help-circle-outline"
          title={t('settings.help')}
          subtitle={t('settings.version', { version: Constants.expoConfig?.version ?? '—' })}
          onPress={() => router.push('/about')}
        />
      </SettingsSection>

      {DEV_TOOLS.enabled ? (
        <SettingsSection title={t('settings.sectionDeveloper')}>
          <SettingsRow
            icon="construct-outline"
            title={t('settings.devTools')}
            subtitle={t('settings.devToolsHint')}
            onPress={() => router.push('/dev-tools')}
          />
        </SettingsSection>
      ) : null}

      <SettingsSection>
        <SettingsRow
          icon="log-out-outline"
          title={t('settings.logOut')}
          subtitle={user?.email ?? undefined}
          onPress={handleLogout}
          danger
        />
      </SettingsSection>
    </SettingsScreen>
  );
}
