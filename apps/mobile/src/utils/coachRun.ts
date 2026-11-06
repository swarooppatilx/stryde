import type { Activity } from '@/types';
import { type DebriefReading, type EffortSignal, effortSignal } from '@/utils/effortSignal';
import { timeInZones, type ZoneFloors } from '@/utils/heartRateZones';

/** What the coach is told about one activity. */
export interface CoachRun {
  activityType: string;
  distanceM: number;
  durationS: number;
  elevationGainM?: number;
  startedAt: string;
  name?: string;
  debrief?: string;
  effort?: number;
  /** How hard it was, read from the debrief, the athlete's marks or the heart-rate zones. */
  signal?: EffortSignal;
  /** How the athlete said it felt: the debrief's wording, else the mark on the activity. */
  feel?: CoachFeel;
  avgHr?: number;
}

export type CoachFeel = 'great' | 'good' | 'ok' | 'bad' | 'terrible';

export interface CoachNote extends Partial<DebriefReading> {
  summary: string;
  effort: number | null;
}

function feelOf(activity: Activity, note?: CoachNote): CoachFeel | undefined {
  if (note?.feel === 'tough') return 'bad';
  return note?.feel ?? activity.feel ?? undefined;
}

export function toCoachRun(
  activity: Activity,
  note?: CoachNote,
  profile: HeartRateProfile = {}
): CoachRun {
  const signal = effortSignal(
    activity,
    note ? { effort: note.effort, feel: note.feel ?? null } : null,
    profile
  );
  const feel = feelOf(activity, note);
  const started = activity.stream?.startedAt ?? activity.createdAt;
  return {
    activityType: activity.activityType,
    distanceM: Math.round(activity.distance),
    durationS: Math.max(1, Math.round(activity.duration / 1000)),
    startedAt: new Date(started).toISOString(),
    ...(activity.elevationGain ? { elevationGainM: Math.round(activity.elevationGain) } : {}),
    ...(activity.name ? { name: activity.name } : {}),
    ...(note?.summary ? { debrief: note.summary } : {}),
    ...(note?.effort ? { effort: note.effort } : {}),
    ...(signal ? { signal } : {}),
    ...(feel ? { feel } : {}),
    ...(activity.heartRate ? { avgHr: Math.round(activity.heartRate.avg) } : {}),
  };
}

/** What the sensors and splits measured, as the coach's review reads it. */
export interface CoachVitals {
  splits?: { index: number; paceS: number; elevationM?: number }[];
  heartRate?: { avg: number; max: number; driftBpm?: number };
  zones?: { label: string; minutes: number }[];
  maxHr?: number;
  restingHr?: number;
  cadenceSpm?: number;
  powerW?: number;
  calories?: number;
  elevationLossM?: number;
  stoppedS?: number;
  bestEfforts?: { distanceM: number; timeS: number }[];
  feel?: string;
  effort?: string;
}

export interface HeartRateProfile {
  maxHr?: number | null;
  restingHr?: number;
  zoneFloors?: ZoneFloors;
}

/** A partial split shorter than this says nothing about pace. */
const MIN_SPLIT_M = 200;
/** Stops shorter than this are traffic lights, not worth a coach's comment. */
const MIN_STOPPED_S = 30;

function mean(values: readonly number[]): number | undefined {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : undefined;
}

/** Second-half average minus first-half average, by time: the cardiac drift of a steady effort. */
function heartRateDrift(hr: { t: readonly number[]; bpm: readonly number[] }): number | undefined {
  const end = hr.t.at(-1);
  if (!end || hr.t.length < 20) return undefined;
  const first: number[] = [];
  const second: number[] = [];
  hr.t.forEach((t, i) => {
    const bpm = hr.bpm[i] as number;
    if (!(bpm >= 30 && bpm <= 250)) return;
    (t < end / 2 ? first : second).push(bpm);
  });
  const a = mean(first);
  const b = mean(second);
  return a === undefined || b === undefined ? undefined : Math.round(b - a);
}

export function toCoachVitals(activity: Activity, profile: HeartRateProfile = {}): CoachVitals {
  const stream = activity.stream;
  const vitals: CoachVitals = {};

  const splits = (activity.splits ?? [])
    .filter((s) => s.distance >= MIN_SPLIT_M && s.movingTime > 0)
    .map((s) => ({
      index: s.index,
      paceS: Math.round(s.movingTime / 1000 / (s.distance / 1000)),
      ...(s.elevation === undefined ? {} : { elevationM: Math.round(s.elevation) }),
    }));
  if (splits.length) vitals.splits = splits;

  if (activity.heartRate) {
    const drift = stream?.heartRate ? heartRateDrift(stream.heartRate) : undefined;
    vitals.heartRate = {
      avg: Math.round(activity.heartRate.avg),
      max: Math.round(activity.heartRate.max),
      ...(drift === undefined ? {} : { driftBpm: drift }),
    };
  }
  if (stream?.heartRate && profile.maxHr) {
    const zones = timeInZones(
      stream.heartRate,
      profile.maxHr,
      profile.restingHr,
      profile.zoneFloors
    )
      .filter((z) => z.seconds >= 30)
      .map((z) => ({ label: z.zone.label, minutes: Math.round(z.seconds / 6) / 10 }));
    if (zones.length) vitals.zones = zones;
  }
  if (profile.maxHr) vitals.maxHr = profile.maxHr;
  if (profile.restingHr) vitals.restingHr = profile.restingHr;

  const cadence = mean(stream?.cadence?.spm.filter((spm) => spm > 0) ?? []);
  if (cadence) vitals.cadenceSpm = Math.round(cadence);
  if (activity.avgPower) vitals.powerW = Math.round(activity.avgPower);
  if (activity.caloriesBurned) vitals.calories = Math.round(activity.caloriesBurned);
  if (activity.elevationLoss) vitals.elevationLossM = Math.round(activity.elevationLoss);

  const elapsedS = stream?.t.at(-1);
  if (elapsedS !== undefined) {
    const stoppedS = Math.round(elapsedS - activity.duration / 1000);
    if (stoppedS >= MIN_STOPPED_S) vitals.stoppedS = stoppedS;
  }
  if (activity.bestEfforts?.length) {
    vitals.bestEfforts = activity.bestEfforts.map((e) => ({
      distanceM: e.distance,
      timeS: Math.round(e.movingTime / 1000),
    }));
  }
  if (activity.feel) vitals.feel = activity.feel;
  if (activity.effort) vitals.effort = activity.effort;
  return vitals;
}

const HISTORY_DAYS = 14;
const HISTORY_MAX = 14;

/** The last two weeks of real, non-commute activities, newest first, each with its debrief when there is one. */
export function recentHistory(
  activities: readonly Activity[],
  notes: Readonly<Record<string, CoachNote>>,
  now: number,
  profile: HeartRateProfile = {}
): CoachRun[] {
  const since = now - HISTORY_DAYS * 24 * 60 * 60 * 1000;
  return activities
    .filter(
      (a) =>
        !a.mocked && !a.isCommute && new Date(a.stream?.startedAt ?? a.createdAt).getTime() >= since
    )
    .map((a) => toCoachRun(a, notes[a.id], profile))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, HISTORY_MAX);
}

/** Today's date in the athlete's own time zone, the key a daily plan is kept under. */
export function localDay(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
