import { READINESS_COPY as C } from '@/constants/copy';

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

function locationCheck(input: ReadinessInput): ReadinessCheck {
  const { location } = input;
  const settings = { kind: 'openAppSettings', label: C.locationBlockedAction } as const;
  if (!location) return ok('location', C.locationBlockedTitle);
  if (!location.granted) {
    return {
      id: 'location',
      status: 'blocked',
      title: C.locationBlockedTitle,
      detail: C.locationBlockedDetail,
      action: settings,
    };
  }
  if (location.precise === false) {
    return {
      id: 'location',
      status: 'warn',
      title: C.locationApproxTitle,
      detail: C.locationApproxDetail,
      action: { ...settings, label: C.locationApproxAction },
    };
  }
  if (input.backgroundLocation === false) {
    return {
      id: 'location',
      status: 'warn',
      title: C.locationBackgroundTitle,
      detail: C.locationBackgroundDetail,
      action: { ...settings, label: C.locationBackgroundAction },
    };
  }
  return ok('location', C.locationBlockedTitle);
}

/**
 * The pre-run checks, worst first (blocked, warn, tip, ok; stable within a status).
 * Battery use cannot be read with the installed packages, so it is always a `tip`.
 */
export function readinessChecks(input: ReadinessInput): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [
    locationCheck(input),
    input.servicesOn === false
      ? {
          id: 'services',
          status: 'blocked',
          title: C.servicesTitle,
          detail: C.servicesDetail,
          action: { kind: 'openLocationSettings', label: C.servicesAction },
        }
      : ok('services', C.servicesTitle),
    input.notifications === false
      ? {
          id: 'notifications',
          status: 'warn',
          title: C.notificationsTitle,
          detail: C.notificationsDetail,
          action: { kind: 'openAppSettings', label: C.notificationsAction },
        }
      : ok('notifications', C.notificationsTitle),
    {
      id: 'battery',
      status: 'tip',
      title: C.batteryTitle,
      detail: C.batteryDetail,
      action: { kind: 'openAppSettings', label: C.batteryAction },
    },
    input.freeStorageBytes !== null && input.freeStorageBytes < LOW_STORAGE_BYTES
      ? { id: 'storage', status: 'warn', title: C.storageTitle, detail: C.storageDetail }
      : ok('storage', C.storageTitle),
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
