import { describe, expect, it } from 'vitest';
import { eventStatus } from '@/utils/eventStatus';

const day = (d: number, h = 12) => new Date(2026, 2, d, h, 0);

describe('eventStatus', () => {
  const start = day(10, 8);
  const end = day(14, 20);

  it('counts calendar days while the event runs', () => {
    expect(eventStatus(start, end, day(11))).toEqual({ phase: 'live', label: '3 days left' });
    expect(eventStatus(start, end, day(13))).toEqual({ phase: 'live', label: '1 day left' });
    expect(eventStatus(start, end, day(14, 9))).toEqual({ phase: 'live', label: 'Ends today' });
  });

  it('says an event that ended an hour ago has ended, not that it ends today', () => {
    expect(eventStatus(start, day(14, 8), day(14, 9))).toEqual({ phase: 'ended', label: 'Ended' });
    expect(eventStatus(start, end, day(20))).toEqual({ phase: 'ended', label: 'Ended' });
  });

  it('says when an event has not started, instead of counting down to its end', () => {
    expect(eventStatus(start, end, day(7))).toEqual({
      phase: 'upcoming',
      label: 'Starts in 3 days',
    });
    expect(eventStatus(start, end, day(9))).toEqual({
      phase: 'upcoming',
      label: 'Starts tomorrow',
    });
    expect(eventStatus(start, end, day(10, 6))).toEqual({
      phase: 'upcoming',
      label: 'Starts today',
    });
  });
});
