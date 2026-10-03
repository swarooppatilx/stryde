import type { Club } from '@/stores/communityStore';
import type { ChallengeEvent } from '@/types/event';

const DAY_MS = 86_400_000;
const hex = (n: number) => `0x${n.toString(16).padStart(40, '0')}`;

export interface CommunitySeed {
  clubs: Club[];
  events: ChallengeEvent[];
}

/** A club and an event owned by seeded athletes, so Groups has something to open on a profile with no chain. */
export function buildCommunitySeed(now: number): CommunitySeed {
  return {
    clubs: [
      {
        id: '9001',
        name: 'Pune Sunrise Runners',
        location: 'Pune',
        description: 'Easy miles before work. All paces welcome.',
        sportType: 'run',
        memberCount: 14,
        owner: hex(1),
        createdAt: now - 60 * DAY_MS,
      },
      {
        id: '9002',
        name: 'Sahyadri Riders',
        location: 'Pune',
        description: 'Weekend rides on the ghats.',
        sportType: 'ride',
        memberCount: 9,
        owner: hex(2),
        createdAt: now - 30 * DAY_MS,
      },
    ],
    events: [
      {
        id: '9101',
        title: 'October 50 km',
        startDate: new Date(now - 10 * DAY_MS),
        endDate: new Date(now + 20 * DAY_MS),
        distanceGoal: 50_000,
        participantCount: 22,
        sportType: 'multi',
        description: 'Cover 50 km any way you like before the month ends.',
        host: hex(3),
      },
      {
        id: '9102',
        title: 'Weekend Long Run',
        startDate: new Date(now + 5 * DAY_MS),
        endDate: new Date(now + 6 * DAY_MS),
        distanceGoal: 21_000,
        participantCount: 8,
        sportType: 'run',
        description: 'A group long run at an easy pace.',
        host: hex(1),
      },
    ],
  };
}

interface CommunitySlice {
  clubs: Club[];
  events: ChallengeEvent[];
}

/** Adds the seed's clubs and events the lists lack, by id; rows already there are left as they are. */
export function mergeCommunitySeed(current: CommunitySlice, seed: CommunitySeed): CommunitySlice {
  const missing = <T extends { id: string }>(have: readonly T[], extra: readonly T[]) =>
    extra.filter((row) => !have.some((h) => h.id === row.id));
  return {
    clubs: [...current.clubs, ...missing(current.clubs, seed.clubs)],
    events: [...current.events, ...missing(current.events, seed.events)],
  };
}
