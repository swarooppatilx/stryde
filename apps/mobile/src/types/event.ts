import type { ActivityType } from '@/types';
import type { MeetingPoint } from '@/utils/meetingPoint';

export interface ChallengeEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  distanceGoal: number;
  participantCount: number;
  sportType: ActivityType | 'multi';
  description: string;
  /** Host wallet address; undefined for events that predate host tracking. */
  host?: string;
  /** Where the event starts, when the host set one. */
  meetingPoint?: MeetingPoint;
}
