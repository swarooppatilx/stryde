export type GpsLevel = 'searching' | 'good' | 'weak' | 'lost' | 'off' | 'blocked';

export interface GpsSignal {
  level: GpsLevel;
  label: string;
  /** What to try, once the wait for a first fix has gone on long enough that something may be wrong. */
  hint?: string;
}

const WEAK_ACCURACY_M = 20;
const LOST_AFTER_MS = 15_000;
const SLOW_FIRST_FIX_MS = 8000;

export interface SignalContext {
  /** When the wait for the first fix began, so a slow one can say what to check. */
  waitingSince?: number;
  /** False when the phone's location services are switched off: no fix will ever come. */
  servicesOn?: boolean;
  /** False when the app has not been allowed to read the location yet. */
  permitted?: boolean;
}

/** What to tell the user about GPS quality, from the newest fix (null before the first one). */
export function describeGpsSignal(
  fix: { accuracy: number; timestamp: number } | null,
  now: number,
  { waitingSince, servicesOn = true, permitted = true }: SignalContext = {}
): GpsSignal {
  if (!servicesOn) {
    return {
      level: 'off',
      label: 'Location services off',
      hint: 'Turn on location in your phone settings.',
    };
  }
  if (!permitted) {
    return {
      level: 'blocked',
      label: 'Location access needed',
      hint: 'Press Start and allow location when asked.',
    };
  }
  if (!fix) {
    if (waitingSince !== undefined && now - waitingSince > SLOW_FIRST_FIX_MS) {
      return {
        level: 'searching',
        label: 'Acquiring GPS',
        hint: 'Make sure location is on and you have a clear view of the sky.',
      };
    }
    return { level: 'searching', label: 'Acquiring GPS' };
  }
  if (now - fix.timestamp > LOST_AFTER_MS) return { level: 'lost', label: 'No GPS signal' };
  if (fix.accuracy > WEAK_ACCURACY_M) return { level: 'weak', label: 'Weak GPS signal' };
  return { level: 'good', label: 'GPS signal acquired' };
}

export type GpsTone = 'success' | 'warning' | 'danger' | 'muted';

const BARS: Record<GpsLevel, { lit: number; tone: GpsTone }> = {
  good: { lit: 4, tone: 'success' },
  weak: { lit: 2, tone: 'warning' },
  searching: { lit: 0, tone: 'muted' },
  lost: { lit: 0, tone: 'danger' },
  off: { lit: 0, tone: 'danger' },
  blocked: { lit: 0, tone: 'warning' },
};

/** How a signal level draws as a bar meter: how many bars light up, and in which tone. */
export function gpsBars(level: GpsLevel): { total: number; lit: number; tone: GpsTone } {
  return { total: 4, ...BARS[level] };
}
