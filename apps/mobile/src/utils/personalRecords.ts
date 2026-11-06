import type { Activity } from '@/types';
import { isPlausibleBestEffort } from './bestEfforts';
import { formatDistance, formatDuration, formatElevation, type UnitSystem } from './format';

export type RecordKind =
  | 'fastest-400m'
  | 'fastest-1k'
  | 'fastest-1mile'
  | 'fastest-5k'
  | 'fastest-10k'
  | 'fastest-half'
  | 'fastest-marathon'
  | 'longest-distance'
  | 'longest-time'
  | 'biggest-climb';

export interface PersonalRecord {
  kind: RecordKind;
  /** Moving time in ms for the fastest efforts, metres for distance and climb, ms for the longest time. */
  value: number;
  activityId: string;
  /** When the activity was done, for the date next to the record. */
  at: Date;
  /** For the fastest efforts: the next best times, each from a different activity (best first). */
  runnersUp?: Array<{ value: number; activityId: string; at: Date }>;
}

/** How many runners-up a fastest-effort record lists beside the record itself. */
const RUNNERS_UP = 2;

const FASTEST: readonly { kind: RecordKind; distance: number }[] = [
  { kind: 'fastest-400m', distance: 400 },
  { kind: 'fastest-1k', distance: 1000 },
  { kind: 'fastest-1mile', distance: 1609 },
  { kind: 'fastest-5k', distance: 5000 },
  { kind: 'fastest-10k', distance: 10_000 },
  { kind: 'fastest-half', distance: 21_097 },
  { kind: 'fastest-marathon', distance: 42_195 },
];

/** The stretch each fastest-effort record covers, in metres. */
export const RECORD_DISTANCE: Partial<Record<RecordKind, number>> = Object.fromEntries(
  FASTEST.map((f) => [f.kind, f.distance])
);

/** A record's value as shown: a time, a distance or a climb. */
export function recordValueText(
  record: Pick<PersonalRecord, 'kind' | 'value'>,
  unitSystem: UnitSystem
): string {
  switch (record.kind) {
    case 'longest-distance':
      return formatDistance(record.value, unitSystem);
    case 'biggest-climb':
      return formatElevation(record.value, unitSystem);
    default:
      return formatDuration(record.value);
  }
}

interface Holder {
  value: number;
  activity: Activity;
}

/** Keeps the better value; on a tie the earlier activity stays the record holder. */
function consider(
  best: Holder | undefined,
  value: number,
  activity: Activity,
  lowerIsBetter: boolean
): Holder {
  if (!best) return { value, activity };
  const better = lowerIsBetter ? value < best.value : value > best.value;
  const tie = value === best.value;
  if (better || (tie && new Date(activity.createdAt) < new Date(best.activity.createdAt))) {
    return { value, activity };
  }
  return best;
}

/**
 * The athlete's bests across the given activities: fastest 400 m up to the marathon, longest distance,
 * longest time and biggest climb. Entries typed in by hand are ignored, since anyone could make
 * them up. A record is left out when there is nothing to base it on.
 */
export function personalRecords(activities: readonly Activity[]): PersonalRecord[] {
  const recorded = activities.filter((a) => !a.isManual && !a.mocked);
  const found = new Map<RecordKind, Holder>();
  const efforts = new Map<RecordKind, Holder[]>();

  for (const a of recorded) {
    found.set('longest-distance', consider(found.get('longest-distance'), a.distance, a, false));
    found.set('longest-time', consider(found.get('longest-time'), a.duration, a, false));
    if ((a.elevationGain ?? 0) > 0) {
      found.set(
        'biggest-climb',
        consider(found.get('biggest-climb'), a.elevationGain as number, a, false)
      );
    }
    for (const { kind, distance } of FASTEST) {
      const effort = a.bestEfforts?.find(
        (e) => e.distance === distance && isPlausibleBestEffort(e, a.distance, a.activityType)
      );
      if (effort) {
        found.set(kind, consider(found.get(kind), effort.movingTime, a, true));
        efforts.set(kind, [
          ...(efforts.get(kind) ?? []),
          { value: effort.movingTime, activity: a },
        ]);
      }
    }
  }

  const order: RecordKind[] = [
    ...FASTEST.map((f) => f.kind),
    'longest-distance',
    'longest-time',
    'biggest-climb',
  ];
  return order.flatMap((kind) => {
    const pick = found.get(kind);
    if (!pick) return [];
    const runnersUp = (efforts.get(kind) ?? [])
      .filter((entry) => entry.activity.id !== pick.activity.id)
      .sort(
        (x, y) =>
          x.value - y.value ||
          new Date(x.activity.createdAt).getTime() - new Date(y.activity.createdAt).getTime()
      )
      .slice(0, RUNNERS_UP)
      .map((entry) => ({
        value: entry.value,
        activityId: entry.activity.id,
        at: new Date(entry.activity.createdAt),
      }));
    return [
      {
        kind,
        value: pick.value,
        activityId: pick.activity.id,
        at: new Date(pick.activity.createdAt),
        ...(runnersUp.length > 0 && { runnersUp }),
      },
    ];
  });
}

export const RECORD_LABEL: Record<RecordKind, string> = {
  'fastest-400m': 'Fastest 400 m',
  'fastest-1k': 'Fastest 1 km',
  'fastest-1mile': 'Fastest mile',
  'fastest-5k': 'Fastest 5 km',
  'fastest-10k': 'Fastest 10 km',
  'fastest-half': 'Fastest half marathon',
  'fastest-marathon': 'Fastest marathon',
  'longest-distance': 'Longest distance',
  'longest-time': 'Longest time',
  'biggest-climb': 'Biggest climb',
};

/**
 * The kinds of record an activity holds. With `activityCount` of 1 or less nothing is returned:
 * the first activity holds every record by default, which says nothing.
 */
export function recordsHeldBy(
  records: readonly PersonalRecord[],
  activityId: string,
  activityCount = 2
): RecordKind[] {
  if (activityCount <= 1) return [];
  return records.filter((r) => r.activityId === activityId).map((r) => r.kind);
}
