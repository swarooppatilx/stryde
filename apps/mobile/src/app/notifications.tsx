import { AppSwitch } from '@/components/app-switch';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';
import { ThemedText } from '@/components/themed-text';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { getPlatform } from '@/platform';
import { NOTIFICATION_KINDS, useNotificationPrefsStore } from '@/stores/notificationPrefsStore';
import { logger } from '@/utils/logger';
import { notificationPermissionLabel } from '@/utils/settingsSummary';

const ACTIVITY_KINDS = NOTIFICATION_KINDS.filter((k) => !k.local);
const DEVICE_KINDS = NOTIFICATION_KINDS.filter((k) => k.local);

export default function NotificationsScreen() {
  const allowed = useNotificationPermission();
  const prefs = useNotificationPrefsStore((s) => s.prefs);
  const setEnabled = useNotificationPrefsStore((s) => s.setEnabled);

  const renderKind = ({ kind, label }: (typeof NOTIFICATION_KINDS)[number]) => (
    <SettingsRow
      key={kind}
      icon="notifications-outline"
      title={label}
      subtitle={prefs[kind] ? 'On' : 'Off'}
      extra={
        <AppSwitch checked={prefs[kind]} onChange={(on) => setEnabled(kind, on)} label={label} />
      }
    />
  );

  return (
    <SettingsScreen title="Notifications">
      <ThemedText type="small" themeColor="textSecondary">
        These choices apply once notifications are enabled on this phone.
      </ThemedText>

      <SettingsSection>
        <SettingsRow
          icon="phone-portrait-outline"
          title="Allow notifications"
          subtitle={notificationPermissionLabel(allowed)}
        />
        <SettingsRow
          icon="settings-outline"
          title="Open phone settings"
          subtitle="Change this in your phone's app settings"
          onPress={() =>
            void getPlatform()
              .readiness.openAppSettings()
              .catch((e) => logger.warn('[Notifications] Opening phone settings failed', e))
          }
        />
      </SettingsSection>

      <SettingsSection title="Activity and people">
        {ACTIVITY_KINDS.map(renderKind)}
      </SettingsSection>
      <SettingsSection title="On this phone" footer="These never leave your phone.">
        {DEVICE_KINDS.map(renderKind)}
      </SettingsSection>
    </SettingsScreen>
  );
}
