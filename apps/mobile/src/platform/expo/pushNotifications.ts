import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform as RNPlatform } from 'react-native';
import { Brand } from '@/constants/theme';
import type { PushNotifications, PushPermission } from '@/platform/ports';

function permissionOf(status: Notifications.NotificationPermissionsStatus): PushPermission {
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

let launchTapTaken = false;

export const expoPushNotifications: PushNotifications = {
  async getPermission() {
    return permissionOf(await Notifications.getPermissionsAsync());
  },

  async requestPermission() {
    return permissionOf(await Notifications.requestPermissionsAsync());
  },

  async setupChannels() {
    if (RNPlatform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('social', {
      name: 'Activity from other athletes',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: Brand.primary,
    });
    await Notifications.setNotificationChannelAsync('recording', {
      name: 'Recording',
      importance: Notifications.AndroidImportance.LOW,
    });
  },

  projectId() {
    const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
    const id = extra?.eas?.projectId;
    return typeof id === 'string' && id.length > 0 ? id : null;
  },

  async getToken(projectId) {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  },

  platform() {
    return RNPlatform.OS === 'ios' ? 'ios' : 'android';
  },

  setForegroundFilter(shouldShow) {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const show = shouldShow(notification.request.content.data);
        return {
          shouldShowBanner: show,
          shouldShowList: show,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      },
    });
  },

  onTap(listener) {
    return Notifications.addNotificationResponseReceivedListener((response) =>
      listener(response.notification.request.content.data)
    );
  },

  async takeLaunchTap() {
    if (launchTapTaken) return null;
    launchTapTaken = true;
    const response = await Notifications.getLastNotificationResponseAsync();
    return response ? response.notification.request.content.data : null;
  },
};
