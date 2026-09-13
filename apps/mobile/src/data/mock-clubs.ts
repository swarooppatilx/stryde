import type { ActivityType } from '@/types';

/** Shared app-side shape for community events, rendered by the Events tab and
 * the event detail screen. Backed by the on-chain EventRegistry now (see
 * @/stores/communityStore's services.event mapping) — this file only owns the
 * type contract those screens + the store agree on. */
export interface ChallengeEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  distanceGoal: number;
  participantCount: number;
  sportType: ActivityType | 'multi';
  description: string;
  /** Wallet address of the event host (on-chain EventRegistry); undefined for
   * legacy/mock events. Lets the UI hide "Leave" for hosts and show a host
   * badge. */
  host?: string;
}

const daysFromNow = (d: number) => new Date(Date.now() + d * 86400000);

// Shown only while EventRegistry isn't deployed on the active chain (see
// services.event.isEventRegistryDeployed) so the Events tab isn't empty.
export const MOCK_EVENTS: ChallengeEvent[] = [
  {
    id: 'event-1',
    title: 'September 100K',
    startDate: daysFromNow(0),
    endDate: daysFromNow(30),
    distanceGoal: 100000,
    participantCount: 1834,
    sportType: 'run',
    description: 'Run 100km in September. Any pace counts.',
  },
  {
    id: 'event-2',
    title: 'Monsoon Trail Series',
    startDate: daysFromNow(7),
    endDate: daysFromNow(45),
    distanceGoal: 50000,
    participantCount: 412,
    sportType: 'hike',
    description: 'Hit the trails during monsoon season.',
  },
  {
    id: 'event-3',
    title: 'Community 5K',
    startDate: daysFromNow(14),
    endDate: daysFromNow(14),
    distanceGoal: 5000,
    participantCount: 2103,
    sportType: 'run',
    description: 'One day. One 5K. Everyone finishes together.',
  },
  {
    id: 'event-4',
    title: 'Ride the Coast',
    startDate: daysFromNow(3),
    endDate: daysFromNow(21),
    distanceGoal: 200000,
    participantCount: 567,
    sportType: 'ride',
    description: 'Cycle 200km along the Konkan coast.',
  },
  {
    id: 'event-5',
    title: 'Yoga Month Challenge',
    startDate: daysFromNow(10),
    endDate: daysFromNow(40),
    distanceGoal: 0,
    participantCount: 891,
    sportType: 'yoga',
    description: '30 days of yoga. Log every session.',
  },
];
