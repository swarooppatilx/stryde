interface CalendarEvent {
  title: string;
  description: string;
  start: Date;
  end: Date;
}

/** `2026-10-27T06:30:00.000Z` as `20261027T063000Z`, the form the calendar link expects. */
const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** A link that opens a calendar's "add event" page filled in; no calendar permission is needed. */
export function calendarLink(event: CalendarEvent): string {
  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    details: event.description,
    dates: `${stamp(event.start)}/${stamp(event.end)}`,
  });
  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}
