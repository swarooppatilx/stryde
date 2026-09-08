import type { ActivityType } from '@/types';

export interface Club {
  id: string;
  name: string;
  location: string;
  memberCount: number;
  sportType: ActivityType | 'multi';
  avatarIcon: string;
  description: string;
}

export interface ChallengeEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  distanceGoal: number;
  participantCount: number;
  sportType: ActivityType | 'multi';
  description: string;
}

const daysFromNow = (d: number) => new Date(Date.now() + d * 86400000);

export const MOCK_CLUBS: Club[] = [
  {
    id: 'club-1',
    name: 'Pune Trail Runners',
    location: 'Pune, India',
    memberCount: 342,
    sportType: 'run',
    avatarIcon: 'walk',
    description: 'Weekly trail runs through Sahyadri foothills.',
  },
  {
    id: 'club-2',
    name: 'Mumbai Cyclists Collective',
    location: 'Mumbai, India',
    memberCount: 891,
    sportType: 'ride',
    avatarIcon: 'bicycle',
    description: 'Group rides every weekend along Marine Drive and beyond.',
  },
  {
    id: 'club-3',
    name: 'Bangalore Hiking Club',
    location: 'Bangalore, India',
    memberCount: 567,
    sportType: 'hike',
    avatarIcon: 'leaf',
    description: 'Exploring trails around Nandi Hills and Coorg.',
  },
  {
    id: 'club-4',
    name: 'Deccan Swim Club',
    location: 'Pune, India',
    memberCount: 198,
    sportType: 'swim',
    avatarIcon: 'water',
    description: 'Open water and pool sessions for all levels.',
  },
  {
    id: 'club-5',
    name: 'Western Ghats Cycling',
    location: 'Pune, India',
    memberCount: 445,
    sportType: 'ride',
    avatarIcon: 'bicycle',
    description: 'Challenging rides through the Western Ghats.',
  },
  {
    id: 'club-6',
    name: 'India Multi-Sport',
    location: 'Mumbai, India',
    memberCount: 234,
    sportType: 'multi',
    avatarIcon: 'fitness',
    description: 'Run, ride, swim — we do it all.',
  },
  {
    id: 'club-7',
    name: 'Pune Runners Collective',
    location: 'Pune, India',
    memberCount: 1203,
    sportType: 'run',
    avatarIcon: 'walk',
    description: "Pune's largest running community. All paces welcome.",
  },
  {
    id: 'club-8',
    name: 'Koramangala Runners',
    location: 'Bangalore, India',
    memberCount: 678,
    sportType: 'run',
    avatarIcon: 'walk',
    description: 'Morning runs from Cubbon Park. 5K to half-marathon.',
  },
];

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
