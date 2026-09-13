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
   * events that predate host tracking. Lets the UI hide "Leave" for hosts and show a host
   * badge. */
  host?: string;
}
