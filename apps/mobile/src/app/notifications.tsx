import { AppSwitch } from '@/components/app-switch';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';
import { ThemedText } from '@/components/themed-text';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { type TKey, useT } from '@/i18n';
import { getPlatform } from '@/platform';
import {
  NOTIFICATION_KINDS,
  type NotificationKind,
  useNotificationPrefsStore,
} from '@/stores/notificationPrefsStore';
import { logger } from '@/utils/logger';
import { notificationPermissionLabel } from '@/utils/settingsSummary';

const KIND_KEY: Record<NotificationKind, TKey> = {
  newFollower: 'notifications.kindNewFollower',
  kudos: 'notifications.kindKudos',
  comments: 'notifications.kindComments',
  mentions: 'notifications.kindMentions',
  friendActivities: 'notifications.kindFriendActivities',
  clubUpdates: 'notifications.kindClubUpdates',
  challenges: 'notifications.kindChallenges',
  milestones: 'notifications.kindMilestones',
  segments: 'notifications.kindSegments',
  goalReached: 'notifications.kindGoalReached',
  streakAtRisk: 'notifications.kindStreakAtRisk',
  weeklySummary: 'notifications.kindWeeklySummary',
  recordingNotice: 'notifications.kindRecordingNotice',
  uploadFailure: 'notifications.kindUploadFailure',
};

const ACTIVITY_KINDS = NOTIFICATION_KINDS.filter((k) => !k.local);
const DEVICE_KINDS = NOTIFICATION_KINDS.filter((k) => k.local);

export default function NotificationsScreen() {
  const t = useT();
  const allowed = useNotificationPermission();
  const prefs = useNotificationPrefsStore((s) => s.prefs);
  const setEnabled = useNotificationPrefsStore((s) => s.setEnabled);

  const renderKind = ({ kind }: (typeof NOTIFICATION_KINDS)[number]) => {
    const label = t(KIND_KEY[kind]);
    return (
      <SettingsRow
        key={kind}
        icon="notifications-outline"
        title={label}
        subtitle={prefs[kind] ? t('common.on') : t('common.off')}
        extra={
          <AppSwitch checked={prefs[kind]} onChange={(on) => setEnabled(kind, on)} label={label} />
        }
      />
    );
  };

  return (
    <SettingsScreen title={t('notifications.title')}>
      <ThemedText type="small" themeColor="textSecondary">
        {t('notifications.intro')}
      </ThemedText>

      <SettingsSection>
        <SettingsRow
          icon="phone-portrait-outline"
          title={t('notifications.allow')}
          subtitle={notificationPermissionLabel(allowed, t)}
        />
        <SettingsRow
          icon="settings-outline"
          title={t('notifications.openSettings')}
          subtitle={t('notifications.openSettingsHint')}
          onPress={() =>
            void getPlatform()
              .readiness.openAppSettings()
              .catch((e) => logger.warn('[Notifications] Opening phone settings failed', e))
          }
        />
      </SettingsSection>

      <SettingsSection title={t('notifications.sectionActivity')}>
        {ACTIVITY_KINDS.map(renderKind)}
      </SettingsSection>
      <SettingsSection
        title={t('notifications.sectionDevice')}
        footer={t('notifications.deviceFooter')}
      >
        {DEVICE_KINDS.map(renderKind)}
      </SettingsSection>
    </SettingsScreen>
  );
}
