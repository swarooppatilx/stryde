import type { Activity, ActivityStream } from '@/types';
import { achievementsEarnedBy } from './achievements';
import { isPlausibleBestEffort } from './bestEfforts';
import { pointAlongRoute } from './colorSegments';
import type { UnitSystem } from './format';
import type { LngLatPair } from './mapData';
import {
  personalRecords,
  RECORD_DISTANCE,
  RECORD_LABEL,
  type RecordKind,
  recordsHeldBy,
  recordValueText,
} from './personalRecords';

export interface ResultRecord {
  kind: RecordKind;
  activityId: string;
  label: string;
  stat: string;
}

export interface ResultAchievement {
  id: string;
  label: string;
  stat: string;
}

export interface ActivityResults {
  bestEffortCount: number;
  records: ResultRecord[];
  achievements: ResultAchievement[];
}

/** Best efforts, records and badges this activity earned, from the athlete's own history. */
export function activityResults(
  activity: Activity,
  ownActivities: readonly Activity[],
  unitSystem: UnitSystem
): ActivityResults {
  const bestEffortCount = (activity.bestEfforts ?? []).filter((e) =>
    isPlausibleBestEffort(e, activity.distance, activity.activityType)
  ).length;
  const sameSport = ownActivities.filter((a) => a.activityType === activity.activityType);
  const all = personalRecords(sameSport);
  const held = new Set(recordsHeldBy(all, activity.id, sameSport.length));
  const records = all
    .filter((r) => held.has(r.kind) && r.activityId === activity.id)
    .map((r) => ({
      kind: r.kind,
      activityId: r.activityId,
      label: RECORD_LABEL[r.kind],
      stat: recordValueText(r, unitSystem),
    }));
  const achievements = (achievementsEarnedBy(ownActivities).get(activity.id) ?? []).map((a) => ({
    id: a.id,
    label: a.title,
    stat: a.description,
  }));
  return { bestEffortCount, records, achievements };
}

/**
 * Where, in metres from the start, the quickest stretch of `distance` begins on a stream; null when
 * the stream has no distances or never covers that far. Thinned streams make this approximate.
 */
export function fastestWindowStart(stream: ActivityStream, distance: number): number | null {
  const d = stream.d;
  if (!d || d.length !== stream.t.length || d.length < 2) return null;
  let best: { time: number; start: number } | null = null;
  let start = 0;
  for (let end = 1; end < d.length; end++) {
    const reach = d[end] as number;
    if (reach - (d[0] as number) < distance) continue;
    while (start + 1 < end && reach - (d[start + 1] as number) >= distance) start++;
    const time = (stream.t[end] as number) - (stream.t[start] as number);
    if (time > 0 && (best === null || time < best.time)) best = { time, start: d[start] as number };
  }
  return best ? best.start : null;
}

const PIN_LABEL: Partial<Record<RecordKind, string>> = {
  'fastest-400m': '400',
  'fastest-1k': '1K',
  'fastest-1mile': '1M',
  'fastest-5k': '5K',
  'fastest-10k': '10K',
  'fastest-half': 'HM',
  'fastest-marathon': 'M',
};

export interface ResultPin {
  id: string;
  label: string;
  coordinate: LngLatPair;
}

/**
 * Pins where each fastest-effort record began on the route. Longest-distance, longest-time and climb
 * records and badges have no position, so they get none.
 */
export function recordPins(
  kinds: readonly RecordKind[],
  stream: ActivityStream | undefined,
  coordinates: readonly LngLatPair[]
): ResultPin[] {
  if (!stream || coordinates.length < 2) return [];
  const pins: ResultPin[] = [];
  for (const kind of kinds) {
    const distance = RECORD_DISTANCE[kind];
    const label = PIN_LABEL[kind];
    if (distance === undefined || label === undefined) continue;
    const start = fastestWindowStart(stream, distance);
    if (start === null) continue;
    const coordinate = pointAlongRoute(coordinates, start);
    if (coordinate) pins.push({ id: kind, label, coordinate });
  }
  return pins;
}
