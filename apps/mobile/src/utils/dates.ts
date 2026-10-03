/** Every date shown to the user goes through here so it follows the device locale. */
type Input = Date | string | number;

const format = (value: Input, options: Intl.DateTimeFormatOptions, locale?: string) =>
  new Date(value).toLocaleDateString(locale, options);

export const formatDay = (value: Input, locale?: string) =>
  format(value, { month: 'short', day: 'numeric' }, locale);

export const formatDayYear = (value: Input, locale?: string) =>
  format(value, { month: 'short', day: 'numeric', year: 'numeric' }, locale);

export const formatLongDate = (value: Input, locale?: string) =>
  format(value, { month: 'long', day: 'numeric', year: 'numeric' }, locale);

export const formatMonthYear = (value: Input, locale?: string) =>
  format(value, { month: 'long', year: 'numeric' }, locale);

export const formatWeekdayDay = (value: Input, locale?: string) =>
  format(value, { weekday: 'short', month: 'short', day: 'numeric' }, locale);

export const formatTimeOfDay = (value: Input, locale?: string) =>
  new Date(value).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });

/** A moment with its day and time, e.g. a challenge deadline. */
export const formatDateTime = (value: Input, locale?: string) =>
  `${formatDayYear(value, locale)} at ${formatTimeOfDay(value, locale)}`;

export function formatDateRange(
  start: Input,
  end: Input,
  { locale, withYear = false }: { locale?: string; withYear?: boolean } = {}
): string {
  const s = new Date(start);
  const e = new Date(end);
  const last = withYear ? formatDayYear : formatDay;
  if (s.toDateString() === e.toDateString()) return last(s, locale);
  return `${formatDay(s, locale)} – ${last(e, locale)}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` of the date as the athlete sees it. `toISOString` would give the UTC day, a day off for a morning pick east of Greenwich. */
export function toCalendarDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of a saved `YYYY-MM-DD`. `new Date('YYYY-MM-DD')` is UTC midnight, the evening before west of Greenwich. */
export function parseCalendarDay(day: string): Date {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

/** Athletes must be at least this old to sign up. */
const MIN_AGE_YEARS = 13;

/** Latest accepted birthday: today, `MIN_AGE_YEARS` years ago. */
export function latestBirthday(today = new Date()): Date {
  const date = new Date(today);
  date.setFullYear(date.getFullYear() - MIN_AGE_YEARS);
  return date;
}
