import { logBuffer } from './logger';

type Field = number | string | boolean | null | undefined;

let enabled = false;

/** Turns the verbose recording trace on or off; off by default since it logs coordinates. */
export function setTrackTrace(on: boolean): void {
  enabled = on;
}

export function isTrackTraceOn(): boolean {
  return enabled;
}

function format(key: string, value: Field): string {
  if (typeof value !== 'number') return `${key}=${value}`;
  if (!Number.isFinite(value)) return `${key}=${value}`;
  if (key === 'lat' || key === 'lng') return `${key}=${value.toFixed(6)}`;
  return `${key}=${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

/**
 * One `[trace]` line of `key=value` pairs per recording event, printed whatever the console level so it reaches
 * logcat (`adb logcat -s ReactNativeJS`) in release builds, and kept in the in-app log buffer.
 */
export function trackTrace(event: string, fields: Record<string, Field>): void {
  if (!enabled) return;
  const line = `[trace] ${event} ${Object.entries(fields)
    .map(([k, v]) => format(k, v))
    .join(' ')}`;
  logBuffer.add('debug', [line]);
  console.info(line);
}
