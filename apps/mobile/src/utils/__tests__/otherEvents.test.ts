import { describe, expect, it } from 'vitest';
import type { ChallengeEvent } from '@/types/event';
import { orderEvents, otherEvents } from '@/utils/otherEvents';

const NOW = new Date(2026, 9, 27, 12);
const day = (offset: number) => new Date(2026, 9, 27 + offset, 12);

const event = (id: string, startOffset: number, endOffset: number): ChallengeEvent => ({
  id,
  title: id,
  startDate: day(startOffset),
  endDate: day(endOffset),
  distanceGoal: 0,
  participantCount: 0,
  sportType: 'run',
  description: '',
});

describe('otherEvents', () => {
  it('leaves out the event being viewed and any that have ended', () => {
    const list = [event('self', 1, 5), event('old', -10, -2), event('next', 2, 6)];

    expect(otherEvents(list, 'self', NOW, 3).map((e) => e.id)).toEqual(['next']);
  });

  it('puts events that are on now before ones that have not started, soonest first', () => {
    const list = [
      event('later', 10, 20),
      event('soon', 2, 6),
      event('live-long', -3, 30),
      event('live-short', -1, 2),
    ];

    expect(otherEvents(list, 'x', NOW, 10).map((e) => e.id)).toEqual([
      'live-short',
      'live-long',
      'soon',
      'later',
    ]);
  });

  it('returns at most the limit', () => {
    const list = [event('a', 1, 2), event('b', 2, 3), event('c', 3, 4)];

    expect(otherEvents(list, 'x', NOW, 2)).toHaveLength(2);
  });
});

describe('orderEvents', () => {
  it('lists events on now first, then upcoming by start date, then ended ones latest first', () => {
    const list = [
      event('ended-old', -20, -15),
      event('upcoming-far', 10, 12),
      event('ended-new', -8, -3),
      event('live', -1, 3),
      event('upcoming-near', 2, 4),
    ];

    expect(orderEvents(list, NOW).map((e) => e.id)).toEqual([
      'live',
      'upcoming-near',
      'upcoming-far',
      'ended-new',
      'ended-old',
    ]);
  });

  it('does not change the list it was given', () => {
    const list = [event('b', 5, 6), event('a', 1, 2)];

    orderEvents(list, NOW);

    expect(list.map((e) => e.id)).toEqual(['b', 'a']);
  });
});
