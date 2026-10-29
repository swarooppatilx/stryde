import type { PushPermission } from '@/platform/ports';

export type NotificationSetupAction = 'ask' | 'open-settings' | 'none';

/**
 * What the setup step offers for notifications. While the phone has not been asked, a tap can show
 * the system prompt; after a denial it will not show again, so the only way back is the settings page.
 */
export function notificationSetupAction(
  permission: PushPermission | null
): NotificationSetupAction {
  if (permission === 'granted') return 'none';
  if (permission === 'denied') return 'open-settings';
  // Unknown (the check failed) is treated as askable: asking is harmless, a missing button is not.
  return 'ask';
}
