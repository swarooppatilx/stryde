import type { Activity } from '@/types';
import { formatWeekdayDay } from '@/utils/dates';
import { formatDistance, formatDuration, formatPaceOrSpeed, type UnitSystem } from '@/utils/format';

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

function relativeDay(when: Date, now: Date): string {
  const days = Math.round((startOfDay(now).getTime() - startOfDay(when).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return formatWeekdayDay(when);
}

/** The one line every activity row shows: day, distance, time, and pace or speed. Parts with nothing to say are left out. */
export function activitySubline(
  activity: Pick<
    Activity,
    'activityType' | 'distance' | 'duration' | 'createdAt' | 'stream' | 'isManual'
  >,
  unitSystem: UnitSystem,
  now: Date = new Date()
): string {
  const when = new Date(activity.stream?.startedAt ?? activity.createdAt);
  const hasDistance = activity.distance > 0;
  const hasDuration = activity.duration > 0;
  const pace =
    hasDistance && hasDuration
      ? formatPaceOrSpeed(activity.activityType, activity.distance, activity.duration, unitSystem)
      : null;

  return [
    relativeDay(when, now),
    hasDistance ? formatDistance(activity.distance, unitSystem) : null,
    hasDuration ? formatDuration(activity.duration) : null,
    pace && pace !== '--' ? pace : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
}
