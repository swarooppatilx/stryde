import { describe, expect, it } from 'vitest';
import { eventJoinState, eventStatus } from '@/utils/eventStatus';

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

describe('eventJoinState', () => {
  it('lets someone join an event that has not ended, and leave one they joined', () => {
    expect(eventJoinState({ isHost: false, isJoined: false, ended: false })).toEqual({
      label: 'Join Event',
      disabled: false,
    });
    expect(eventJoinState({ isHost: false, isJoined: true, ended: false })).toEqual({
      label: 'Joined — Tap to Leave',
      disabled: false,
    });
  });

  it('closes an ended event for everyone: nobody joins it, and leaving it would only spend a transaction', () => {
    expect(eventJoinState({ isHost: false, isJoined: false, ended: true })).toEqual({
      label: 'Event ended',
      disabled: true,
    });
    expect(eventJoinState({ isHost: false, isJoined: true, ended: true })).toEqual({
      label: 'You took part',
      disabled: true,
    });
  });

  it('shows the host as hosting, ended or not', () => {
    expect(eventJoinState({ isHost: true, isJoined: true, ended: false }).label).toBe('Hosting');
    expect(eventJoinState({ isHost: true, isJoined: true, ended: true })).toEqual({
      label: 'Hosting',
      disabled: true,
    });
  });
});
