import { t } from '@/i18n';
import { getPlatform } from '@/platform';
import { ensureForegroundLocation } from '@/services/locationPermission';
import { Alert } from '@/utils/alert';
import type { GpsLevel } from '@/utils/gpsSignal';
import { readOrNull } from '@/utils/readiness';
import { startGate } from '@/utils/startGate';

/** Resolves true for Continue, false for the cancel button or a dismissal. */
function askToContinue(title: string, message: string, cont: string, cancel: string) {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: cont, onPress: () => resolve(true) },
      ],
      { onDismiss: () => resolve(false) }
    );
  });
}

let batterySaverAccepted = false;

export function resetBatterySaverChoice(): void {
  batterySaverAccepted = false;
}

/** Asks once per app session when battery saver is on; Continue is remembered, so a retry does not nag. */
async function confirmBatterySaver(): Promise<boolean> {
  const { battery, readiness } = getPlatform();
  const state = await readOrNull(() => battery.getState());
  if (!state?.lowPowerMode) {
    batterySaverAccepted = false;
    return true;
  }
  if (batterySaverAccepted) return true;
  const action = await new Promise<'continue' | 'settings' | 'dismissed'>((resolve) => {
    Alert.alert(
      t('startGate.batterySaverTitle'),
      t('startGate.batterySaverBody'),
      [
        { text: t('startGate.batterySaverSettings'), onPress: () => resolve('settings') },
        { text: t('startGate.batterySaverContinue'), onPress: () => resolve('continue') },
      ],
      { onDismiss: () => resolve('dismissed') }
    );
  });
  if (action === 'settings') {
    // No battery settings page is reachable from here, so this opens the app's own settings page.
    await readOrNull(() => readiness.openAppSettings());
    return false;
  }
  batterySaverAccepted = action === 'continue';
  return batterySaverAccepted;
}

/** Whether recording may begin: explains whatever stands in the way and returns false, or asks about a missing GPS fix and lets the athlete start anyway. */
export async function confirmStart(session: {
  status: string;
  signalLevel: GpsLevel;
}): Promise<boolean> {
  const { location } = getPlatform();
  const [permission, servicesOn] = await Promise.all([
    readOrNull(() => location.getPermission()),
    readOrNull(() => location.servicesEnabled()),
  ]);
  const dialog = startGate({ ...session, permission, servicesOn: servicesOn ?? true });

  switch (dialog) {
    case null:
      return confirmBatterySaver();
    case 'inProgress':
      Alert.alert(t('startGate.inProgressTitle'), t('startGate.inProgressBody'), [
        { text: t('startGate.close') },
      ]);
      return false;
    case 'servicesOff':
      if (
        await askToContinue(
          t('startGate.servicesOffTitle'),
          t('startGate.servicesOffBody'),
          t('startGate.servicesOffAction'),
          t('common.cancel')
        )
      ) {
        await location.openSettings();
      }
      return false;
    case 'permissionDenied':
    case 'approximate':
      // That flow explains itself, asks when the phone still lets it, and offers the settings page.
      return ensureForegroundLocation();
    case 'noSignal':
      return (
        (await askToContinue(
          t('startGate.noSignalTitle'),
          t('startGate.noSignalBody'),
          t('startGate.noSignalContinue'),
          t('startGate.noSignalWait')
        )) && confirmBatterySaver()
      );
  }
}
