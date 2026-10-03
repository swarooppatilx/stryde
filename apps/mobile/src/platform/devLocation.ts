import type { ScriptedLocationSource } from './replay';

let current: ScriptedLocationSource | null = null;

/** Set at boot in development builds only; the dev-tools screen drives route replays through it. */
export function setDevLocation(source: ScriptedLocationSource | null): void {
  current = source;
}

export function getDevLocation(): ScriptedLocationSource | null {
  return current;
}
