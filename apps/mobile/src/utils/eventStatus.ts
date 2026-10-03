export type EventPhase = 'upcoming' | 'live' | 'ended';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole calendar days from `from` to `to` on the phone's clock, so 11 pm to 1 am is one day. */
function calendarDaysBetween(from: Date, to: Date): number {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY);
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

/** Where an event stands now, in words an athlete can read at a glance. */
export function eventStatus(
  start: Date,
  end: Date,
  now: Date = new Date()
): { phase: EventPhase; label: string } {
  if (now.getTime() > end.getTime()) return { phase: 'ended', label: 'Ended' };

  if (now.getTime() < start.getTime()) {
    const days = calendarDaysBetween(now, start);
    if (days <= 0) return { phase: 'upcoming', label: 'Starts today' };
    if (days === 1) return { phase: 'upcoming', label: 'Starts tomorrow' };
    return { phase: 'upcoming', label: `Starts in ${plural(days, 'day')}` };
  }

  const days = calendarDaysBetween(now, end);
  return { phase: 'live', label: days <= 0 ? 'Ends today' : `${plural(days, 'day')} left` };
}
