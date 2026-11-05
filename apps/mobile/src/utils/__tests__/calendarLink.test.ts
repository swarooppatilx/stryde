import { describe, expect, it } from 'vitest';
import { calendarLink } from '@/utils/calendarLink';

describe('calendarLink', () => {
  const link = calendarLink({
    title: 'October 50K',
    description: 'Cover 50 km & enjoy',
    start: new Date(Date.UTC(2026, 9, 27, 6, 30, 0)),
    end: new Date(Date.UTC(2026, 9, 28, 6, 30, 0)),
  });
  const url = new URL(link);

  it('points at the calendar page that adds an event', () => {
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
  });

  it('carries the title and description, escaped', () => {
    expect(url.searchParams.get('text')).toBe('October 50K');
    expect(url.searchParams.get('details')).toBe('Cover 50 km & enjoy');
  });

  it('gives the start and end as UTC basic timestamps', () => {
    expect(url.searchParams.get('dates')).toBe('20261027T063000Z/20261028T063000Z');
  });
});
