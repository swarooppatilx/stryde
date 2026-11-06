import { t as defaultT, type TFunction } from '@/i18n';

/** `tip` is a static hint that is never a verdict: it says nothing about the phone's actual state. */
export type ReadinessStatus = 'ok' | 'warn' | 'blocked' | 'tip';

export type ReadinessActionKind = 'openAppSettings' | 'openLocationSettings';

export interface ReadinessCheck {
  id: 'location' | 'services' | 'notifications' | 'battery' | 'storage';
  status: ReadinessStatus;
  title: string;
  detail: string;
  action?: { kind: ReadinessActionKind; label: string };
}

/** What the phone reported. `null` means it could not be read, which never raises a warning. */
export interface ReadinessInput {
  location: { granted: boolean; precise?: boolean } | null;
  /** Allowed to read location with the app closed ("all the time"). */
  backgroundLocation: boolean | null;
  servicesOn: boolean | null;
  notifications: boolean | null;
  freeStorageBytes: number | null;
}

/** A device read that failed counts as unknown (null), which never raises a warning. */
export async function readOrNull<T>(read: () => Promise<T> | T): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

export const LOW_STORAGE_BYTES = 200 * 1024 * 1024;

const ORDER: Record<ReadinessStatus, number> = { blocked: 0, warn: 1, tip: 2, ok: 3 };

function ok(id: ReadinessCheck['id'], title: string): ReadinessCheck {
  return { id, status: 'ok', title, detail: '' };
}

function locationCheck(input: ReadinessInput, t: TFunction): ReadinessCheck {
  const { location } = input;
  const settings = {
    kind: 'openAppSettings',
    label: t('readiness.locationBlockedAction'),
  } as const;
  if (!location) return ok('location', t('readiness.locationBlockedTitle'));
  if (!location.granted) {
    return {
      id: 'location',
      status: 'blocked',
      title: t('readiness.locationBlockedTitle'),
      detail: t('readiness.locationBlockedDetail'),
      action: settings,
    };
  }
  if (location.precise === false) {
    return {
      id: 'location',
      status: 'warn',
      title: t('readiness.locationApproxTitle'),
      detail: t('readiness.locationApproxDetail'),
      action: { ...settings, label: t('readiness.locationApproxAction') },
    };
  }
  if (input.backgroundLocation === false) {
    return {
      id: 'location',
      status: 'warn',
      title: t('readiness.locationBackgroundTitle'),
      detail: t('readiness.locationBackgroundDetail'),
      action: { ...settings, label: t('readiness.locationBackgroundAction') },
    };
  }
  return ok('location', t('readiness.locationBlockedTitle'));
}

/**
 * The pre-run checks, worst first (blocked, warn, tip, ok; stable within a status).
 * Battery use cannot be read with the installed packages, so it is always a `tip`.
 */
export function readinessChecks(input: ReadinessInput, t: TFunction = defaultT): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [
    locationCheck(input, t),
    input.servicesOn === false
      ? {
          id: 'services',
          status: 'blocked',
          title: t('readiness.servicesTitle'),
          detail: t('readiness.servicesDetail'),
          action: { kind: 'openLocationSettings', label: t('readiness.servicesAction') },
        }
      : ok('services', t('readiness.servicesTitle')),
    input.notifications === false
      ? {
          id: 'notifications',
          status: 'warn',
          title: t('readiness.notificationsTitle'),
          detail: t('readiness.notificationsDetail'),
          action: { kind: 'openAppSettings', label: t('readiness.notificationsAction') },
        }
      : ok('notifications', t('readiness.notificationsTitle')),
    {
      id: 'battery',
      status: 'tip',
      title: t('readiness.batteryTitle'),
      detail: t('readiness.batteryDetail'),
      action: { kind: 'openAppSettings', label: t('readiness.batteryAction') },
    },
    input.freeStorageBytes !== null && input.freeStorageBytes < LOW_STORAGE_BYTES
      ? {
          id: 'storage',
          status: 'warn',
          title: t('readiness.storageTitle'),
          detail: t('readiness.storageDetail'),
        }
      : ok('storage', t('readiness.storageTitle')),
  ];
  return checks
    .map((check, index) => ({ check, index }))
    .sort((a, b) => ORDER[a.check.status] - ORDER[b.check.status] || a.index - b.index)
    .map(({ check }) => check);
}

/** The rows worth showing: problems, plus the tip only when there is a problem to sit beside. */
export function readinessRows(checks: ReadinessCheck[]): ReadinessCheck[] {
  const problems = checks.filter((c) => c.status === 'warn' || c.status === 'blocked');
  return problems.length === 0 ? [] : checks.filter((c) => c.status !== 'ok');
}
