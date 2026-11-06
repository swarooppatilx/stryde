import { getSportLabel } from '@/constants/activity';
import type { ActivityType, Lap, Split } from '@/types';
import { countRegular } from '@/utils/plural';
import { METERS_PER_MILE, showsSpeed, type UnitSystem } from './format';

/** What to say aloud when a split finishes, or null when there is nothing honest to say. */
export function splitCue(
  split: Split,
  activityType: ActivityType,
  unitSystem: UnitSystem,
  /** Moving time since the start, in ms: said between the distance and the pace when given. */
  totalMs?: number
): string | null {
  if (split.movingTime <= 0 || split.distance <= 0) return null;
  const imperial = unitSystem === 'imperial';
  const unit = imperial ? 'mile' : 'kilometre';
  const unitMeters = imperial ? METERS_PER_MILE : 1000;
  const heard = `${countRegular(split.index, unit)}.${totalMs && totalMs > 0 ? ` Time ${durationWords(totalMs)}.` : ''}`;

  if (showsSpeed(activityType)) {
    const perHour = Math.round(split.distance / unitMeters / (split.movingTime / 3_600_000));
    return `${heard} Speed ${countRegular(perHour, unit)} per hour.`;
  }

  const seconds = Math.round(split.movingTime / 1000 / (split.distance / unitMeters));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const pace = [countRegular(minutes, 'minute'), rest > 0 ? countRegular(rest, 'second') : null]
    .filter(Boolean)
    .join(' ');
  return `${heard} Pace ${pace} per ${unit}.`;
}

export type ActionCueKind = 'start' | 'pause' | 'resume' | 'finish';

const ACTION_VERB: Record<ActionCueKind, string> = {
  start: 'Starting',
  pause: 'Pausing',
  resume: 'Resuming',
  finish: 'Stopping',
};

/** What to say when the athlete starts, pauses, resumes or stops: "Pausing run." */
export function actionCue(kind: ActionCueKind, activityType: ActivityType): string {
  return `${ACTION_VERB[kind]} ${getSportLabel(activityType).toLowerCase()}.`;
}

/** A number a voice can read: no trailing zeros, at most two decimals. */
const spoken = (n: number) => String(Number(n.toFixed(2)));

function distanceWords(meters: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    const miles = meters / METERS_PER_MILE;
    return `${spoken(miles)} ${Number(spoken(miles)) === 1 ? 'mile' : 'miles'}`;
  }
  if (meters < 1000) return countRegular(Math.round(meters), 'metre');
  const km = meters / 1000;
  return `${spoken(km)} ${Number(spoken(km)) === 1 ? 'kilometre' : 'kilometres'}`;
}

function durationWords(ms: number): string {
  const seconds = Math.round(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [
    hours > 0 ? countRegular(hours, 'hour') : null,
    minutes > 0 ? countRegular(minutes, 'minute') : null,
    rest > 0 ? countRegular(rest, 'second') : null,
  ]
    .filter(Boolean)
    .join(' ');
}

/** What to say when a lap closes: "Lap 3. 5 minutes 12 seconds. 1 kilometre." */
export function lapCue(lap: Lap, unitSystem: UnitSystem): string {
  return `Lap ${lap.index}. ${durationWords(lap.duration)}. ${distanceWords(lap.distance, unitSystem)}.`;
}

/** How often distance is said aloud while recording: never, every kilometre (or mile), or every half. */
export type AudioCueInterval = 'off' | 'unit' | 'half';

export const AUDIO_CUE_INTERVALS: readonly AudioCueInterval[] = ['off', 'unit', 'half'];

export function audioCueIntervalLabel(interval: AudioCueInterval, unitSystem: UnitSystem): string {
  const unit = unitSystem === 'imperial' ? 'mi' : 'km';
  if (interval === 'unit') return `Every ${unit}`;
  if (interval === 'half') return `Every half ${unit}`;
  return 'Off';
}

/** A point where a cue is due, counted in half units from the start: 1 is half a unit, 2 a whole one. */
export interface CueMark {
  halves: number;
  whole: boolean;
}

/**
 * The furthest cue point the distance has reached beyond the last one said, or null when none is due.
 * Several passed in one update (a gap in the fixes) give only the latest. Only a higher point counts,
 * so a distance that stands still or slips back across a pause never brings an old one round again.
 */
export function dueCue(
  lastHalves: number,
  meters: number,
  unitMeters: number,
  interval: AudioCueInterval
): CueMark | null {
  if (interval === 'off' || unitMeters <= 0) return null;
  const halves = Math.floor((meters / unitMeters) * 2);
  const reached = interval === 'half' ? halves : halves - (halves % 2);
  if (reached <= lastHalves) return null;
  return { halves: reached, whole: reached % 2 === 0 };
}

/**
 * What to say at a half unit: "Distance 2.5 kilometres. Time 12 minutes 30 seconds."
 * There is no pace here: the pace of a split belongs to the whole unit it finishes.
 */
export function halfCue(halves: number, unitSystem: UnitSystem, totalMs?: number): string {
  const units = unitSystem === 'imperial' ? 'miles' : 'kilometres';
  const time = totalMs && totalMs > 0 ? ` Time ${durationWords(totalMs)}.` : '';
  return `Distance ${spoken(halves / 2)} ${units}.${time}`;
}
