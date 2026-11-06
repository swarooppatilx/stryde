import { afterEach, describe, expect, it } from 'vitest';
import {
  formatDateRange,
  formatDateTime,
  formatDay,
  formatLongDate,
  formatMonthYear,
  formatTimeOfDay,
  formatWeekdayDay,
  formatWhen,
  latestBirthday,
  parseCalendarDay,
  toCalendarDay,
} from '@/utils/dates';

const D = new Date(2026, 2, 5, 14, 7);

describe('date formatting follows the given locale', () => {
  it('formats the same date differently per locale', () => {
    expect(formatDay(D, 'en-US')).toBe('Mar 5');
    expect(formatDay(D, 'de-DE')).not.toBe(formatDay(D, 'en-US'));
  });

  it('covers the shapes the screens use', () => {
    expect(formatLongDate(D, 'en-US')).toBe('March 5, 2026');
    expect(formatMonthYear(D, 'en-US')).toBe('March 2026');
    expect(formatWeekdayDay(D, 'en-US')).toBe('Thu, Mar 5');
    expect(formatTimeOfDay(D, 'en-US')).toMatch(/2:07\s?PM/);
  });

  it('gives a deadline its time as well as its day, so "today" is not a guess', () => {
    expect(formatDateTime(D, 'en-US')).toMatch(/^Mar 5, 2026 at 2:07\s?PM$/);
  });
});

describe('formatDateRange', () => {
  const next = new Date(2026, 2, 7, 9, 0);

  it('shows one date when both ends fall on the same day', () => {
    expect(formatDateRange(D, new Date(2026, 2, 5, 18, 0), { locale: 'en-US' })).toBe('Mar 5');
  });

  it('shows both ends otherwise', () => {
    expect(formatDateRange(D, next, { locale: 'en-US' })).toBe('Mar 5 – Mar 7');
  });

  it('can add the year', () => {
    expect(formatDateRange(D, next, { locale: 'en-US', withYear: true })).toBe(
      'Mar 5 – Mar 7, 2026'
    );
    expect(formatDateRange(D, D, { locale: 'en-US', withYear: true })).toBe('Mar 5, 2026');
  });
});

describe('latestBirthday', () => {
  it('is the same day thirteen years ago', () => {
    expect(latestBirthday(new Date(2026, 9, 17))).toEqual(new Date(2013, 9, 17));
  });
});

describe('calendar days (birthdays)', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('keeps the day the athlete picked, whatever time zone the phone is in', () => {
    // Picked early on 10 May in India: that instant is still 9 May in UTC.
    process.env.TZ = 'Asia/Kolkata';
    expect(toCalendarDay(new Date(2000, 4, 10, 1, 0))).toBe('2000-05-10');

    process.env.TZ = 'America/Los_Angeles';
    expect(toCalendarDay(new Date(2000, 4, 10, 23, 0))).toBe('2000-05-10');
  });

  it('reads a saved day back as that same day on the phone, not the evening before', () => {
    process.env.TZ = 'America/Los_Angeles';
    const date = parseCalendarDay('2000-05-10');

    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2000, 4, 10]);
  });

  it('round-trips', () => {
    expect(toCalendarDay(parseCalendarDay('1987-12-31'))).toBe('1987-12-31');
  });
});

describe('formatWhen', () => {
  const when = new Date(2026, 9, 6, 7, 42);

  it('gives the day and the time of day', () => {
    expect(formatWhen(when, false, 'en-US')).toBe(
      `${formatWeekdayDay(when, 'en-US')} at ${formatTimeOfDay(when, 'en-US')}`
    );
  });

  it('gives only the day when the start time is hidden', () => {
    expect(formatWhen(when, true, 'en-US')).toBe(formatWeekdayDay(when, 'en-US'));
  });
});
