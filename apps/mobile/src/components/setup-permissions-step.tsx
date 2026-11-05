import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { SETUP_COPY } from '@/constants/copy';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getPlatform } from '@/platform';
import type { PushPermission } from '@/platform/ports';
import { ensureForegroundLocation } from '@/services/locationPermission';
import { usePushPrimerStore } from '@/stores/pushPrimerStore';
import { logger } from '@/utils/logger';
import { notificationSetupAction } from '@/utils/notificationSetup';

type Known = boolean | null;

/** Explains why location and notifications help, asks, and carries on whatever the answer. */
export function SetupPermissionsStep({ onNext }: { onNext: () => void }) {
  const theme = useTheme();
  const [location, setLocation] = useState<Known>(null);
  const [notifications, setNotifications] = useState<Known>(null);
  const [pushPermission, setPushPermission] = useState<PushPermission | null>(null);
  const [asking, setAsking] = useState(false);

  const refresh = useCallback(async () => {
    const { location: source, readiness, push } = getPlatform();
    try {
      const [permission, allowed, asked] = await Promise.all([
        source.getPermission(),
        readiness.notificationsAllowed(),
        push.getPermission(),
      ]);
      setLocation(permission.granted);
      setNotifications(allowed);
      setPushPermission(asked);
    } catch (error) {
      logger.warn('[Setup] Could not read permissions', error);
    }
  }, []);

  // Coming back from the phone's settings is how a changed answer is noticed.
  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const allowLocation = async () => {
    setAsking(true);
    try {
      setLocation(await ensureForegroundLocation());
    } catch (error) {
      logger.warn('[Setup] Location request failed', error);
    } finally {
      setAsking(false);
    }
  };

  const allowNotifications = async () => {
    setAsking(true);
    try {
      const answer = await getPlatform().push.requestPermission();
      setPushPermission(answer);
      setNotifications(answer === 'granted');
      // The question has been put here, so the later "turn on notifications" sheet need not ask again.
      usePushPrimerStore.getState().answer();
    } catch (error) {
      logger.warn('[Setup] Notification request failed', error);
    } finally {
      setAsking(false);
    }
  };

  const row = (props: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    body: string;
    status: string;
    on: boolean;
    action?: { label: string; onPress: () => void; loading?: boolean };
  }) => (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.cardHeader}>
        <Ionicons name={props.icon} size={22} color={theme.text} />
        <ThemedText type="smallBold">{props.title}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {props.body}
      </ThemedText>
      <ThemedText type="caption" themeColor={props.on ? 'text' : 'textSecondary'}>
        {props.status}
      </ThemedText>
      {props.action && !props.on && (
        <AppButton
          variant="secondary"
          size="small"
          loading={props.action.loading}
          onPress={props.action.onPress}
        >
          {props.action.label}
        </AppButton>
      )}
    </View>
  );

  const copy = SETUP_COPY.permissions;
  const notificationStatus = () => {
    if (notifications === true) return copy.notificationsOn;
    return pushPermission === 'denied' ? copy.notificationsDenied : copy.notificationsUnknown;
  };
  return (
    <>
      {row({
        icon: 'location-outline',
        title: copy.locationTitle,
        body: copy.locationBody,
        status: location ? copy.locationOn : copy.locationOff,
        on: location === true,
        action: { label: copy.locationAllow, onPress: () => void allowLocation(), loading: asking },
      })}
      {row({
        icon: 'notifications-outline',
        title: copy.notificationsTitle,
        body: copy.notificationsBody,
        status: notificationStatus(),
        on: notifications === true,
        action:
          notificationSetupAction(pushPermission) === 'open-settings'
            ? {
                label: copy.notificationsOpen,
                onPress: () => void getPlatform().readiness.openAppSettings(),
              }
            : {
                label: copy.notificationsAllow,
                onPress: () => void allowNotifications(),
                loading: asking,
              },
      })}
      <AppButton onPress={onNext}>{SETUP_COPY.continue}</AppButton>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: BorderRadius.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
