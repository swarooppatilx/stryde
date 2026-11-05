import type { GpsLevel } from '@/utils/gpsSignal';

export type StartGateDialog =
  | 'inProgress'
  | 'servicesOff'
  | 'permissionDenied'
  | 'approximate'
  | 'noSignal';

export interface StartGateInput {
  /** The tracking session's status; anything but idle means a recording exists. */
  status: string;
  servicesOn: boolean;
  /** null when the phone could not say, which never blocks. */
  permission: { granted: boolean; canAskAgain?: boolean; precise?: boolean } | null;
  signalLevel: GpsLevel;
}

/** Which dialog, if any, to show before a recording starts. The first problem wins; null means go. */
export function startGate({
  status,
  servicesOn,
  permission,
  signalLevel,
}: StartGateInput): StartGateDialog | null {
  if (status !== 'idle') return 'inProgress';
  if (!servicesOn) return 'servicesOff';
  if (permission && !permission.granted) return 'permissionDenied';
  if (permission && permission.precise === false) return 'approximate';
  if (signalLevel === 'searching' || signalLevel === 'lost') return 'noSignal';
  return null;
}
