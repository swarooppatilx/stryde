import { describe, expect, it } from 'vitest';
import { type Club, filterClubs, filterEvents, orderClubs } from '@/stores/communityStore';
import type { ChallengeEvent } from '@/types/event';

const club = (name: string, location: string, sportType: Club['sportType']): Club => ({
  id: name,
  name,
  location,
  sportType,
  description: '',
  memberCount: 1,
  owner: '0xowner',
  createdAt: 0,
});

const event = (
  id: string,
  title: string,
  sportType: ChallengeEvent['sportType']
): ChallengeEvent => ({
  id,
  title,
  sportType,
  startDate: new Date(0),
  endDate: new Date(0),
  distanceGoal: 0,
  participantCount: 0,
  description: '',
});

describe('filterClubs', () => {
  const clubs = [club('Pune Runners', 'Pune', 'run'), club('Deccan Riders', 'Pune', 'ride')];

  it('matches name or location, ignoring case', () => {
    expect(filterClubs(clubs, 'deccan', 'all').map((c) => c.name)).toEqual(['Deccan Riders']);
    expect(filterClubs(clubs, 'PUNE', 'all')).toHaveLength(2);
  });

  it('also matches the description', () => {
    const described = [
      { ...club('Sunrise', 'Pune', 'run'), description: 'Easy miles before work' },
    ];

    expect(filterClubs(described, 'before work', 'all')).toHaveLength(1);
    expect(filterClubs(described, 'night', 'all')).toHaveLength(0);
  });

  it('narrows to one sport', () => {
    expect(filterClubs(clubs, '', 'ride').map((c) => c.name)).toEqual(['Deccan Riders']);
  });
});

describe('filterEvents', () => {
  it('also matches the description', () => {
    const events = [{ ...event('1', 'October 50K', 'multi'), description: 'Cover 50 km any way' }];

    expect(filterEvents(events, 'any way', 'all')).toHaveLength(1);
  });

  it('matches the title within the chosen sport', () => {
    const events = [event('1', 'Sunday 10K', 'run'), event('2', 'Sunday Spin', 'ride')];

    expect(filterEvents(events, 'sunday', 'run').map((e) => e.id)).toEqual(['1']);
  });
});

describe('orderClubs', () => {
  const big = { ...club('Big', 'Pune', 'run'), id: 'big', memberCount: 90 };
  const small = { ...club('Small', 'Pune', 'run'), id: 'small', memberCount: 5 };
  const mine = { ...club('Mine', 'Pune', 'ride'), id: 'mine', memberCount: 12 };

  it('puts clubs you are in first, then the rest with the most members first', () => {
    expect(orderClubs([small, big, mine], ['mine']).map((c) => c.id)).toEqual([
      'mine',
      'big',
      'small',
    ]);
  });

  it('breaks a tie in members by name, and does not change the list it was given', () => {
    const a = { ...club('Alpha', 'x', 'run'), id: 'a', memberCount: 3 };
    const z = { ...club('Zulu', 'x', 'run'), id: 'z', memberCount: 3 };
    const list = [z, a];

    expect(orderClubs(list, []).map((c) => c.id)).toEqual(['a', 'z']);
    expect(list.map((c) => c.id)).toEqual(['z', 'a']);
  });
});
