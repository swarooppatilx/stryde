import type { ActivityType } from '@/types';

export interface MockUser {
  id: string;
  name: string;
  username: string;
  bio?: string;
  location?: string;
  followers: number;
  following: number;
}

export interface MockComment {
  id: string;
  userId: string;
  text: string;
  createdAt: Date;
  likedBy: string[];
}

export interface MockActivity {
  id: string;
  userId: string;
  name: string;
  activityType: ActivityType;
  distance: number;
  duration: number;
  elevationGain?: number;
  polyline: string;
  territory: [number, number][] | null;
  territoryArea: number;
  image?: string;
  images?: string[];
  createdAt: Date;
  kudos: string[];
  comments: MockComment[];
}

const daysAgo = (d: number) => new Date(Date.now() - d * 86400000);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000);

export const MOCK_USERS: MockUser[] = [
  {
    id: 'user-1',
    name: 'Sarah Chen',
    username: 'sarahc',
    bio: 'Marathon runner. Chasing PRs in every city.',
    location: 'Pune, India',
    followers: 234,
    following: 89,
  },
  {
    id: 'user-2',
    name: 'Marcus Johnson',
    username: 'marcusj',
    bio: 'Trail runner & dog dad. Miles before meals.',
    location: 'Mumbai, India',
    followers: 512,
    following: 143,
  },
  {
    id: 'user-3',
    name: 'Priya Sharma',
    username: 'priyaruns',
    bio: 'Early morning runner. 5AM club.',
    location: 'Pune, India',
    followers: 178,
    following: 67,
  },
  {
    id: 'user-4',
    name: 'Alex Rivera',
    username: 'alexr',
    bio: 'Cyclist turned runner. Everything is a race.',
    location: 'Bangalore, India',
    followers: 89,
    following: 201,
  },
  {
    id: 'user-5',
    name: 'Emma Wilson',
    username: 'emmaw',
    bio: 'Hiking & walking. Taking the scenic route.',
    location: 'Pune, India',
    followers: 156,
    following: 94,
  },
  {
    id: 'user-6',
    name: 'David Park',
    username: 'davidp',
    bio: 'Weekend warrior. Running off the pizza.',
    location: 'Mumbai, India',
    followers: 67,
    following: 112,
  },
];

// Polyline format: "lng,lat;lng,lat;..."
// Pune area coordinates for realistic routes
export const MOCK_ACTIVITIES: MockActivity[] = [
  // 1. Route only — no image, no territory
  {
    id: 'post-1',
    userId: 'user-1',
    name: 'Morning Tempo Run',
    activityType: 'run',
    distance: 8200,
    duration: 2340000,
    elevationGain: 45,
    polyline:
      '73.8560,18.5200;73.8570,18.5210;73.8580,18.5225;73.8595,18.5235;73.8610,18.5240;73.8625,18.5248;73.8640,18.5255;73.8655,18.5260;73.8670,18.5268;73.8685,18.5275;73.8700,18.5280;73.8715,18.5285;73.8730,18.5290;73.8745,18.5298;73.8760,18.5305;73.8775,18.5310;73.8790,18.5318;73.8800,18.5325',
    territory: null,
    territoryArea: 0,
    createdAt: hoursAgo(2),
    kudos: ['user-2', 'user-3', 'user-5'],
    comments: [
      {
        id: 'c1',
        userId: 'user-2',
        text: 'Solid tempo! What pace were you hitting?',
        createdAt: hoursAgo(1.5),
        likedBy: ['user-1'],
      },
      {
        id: 'c2',
        userId: 'user-1',
        text: 'Around 4:45/km. Felt great!',
        createdAt: hoursAgo(1),
        likedBy: [],
      },
      {
        id: 'c2b',
        userId: 'user-3',
        text: "That's flying! 🔥",
        createdAt: hoursAgo(0.5),
        likedBy: ['user-1', 'user-2'],
      },
    ],
  },
  // 2. Territory capture — route + closed polygon + area
  {
    id: 'post-2',
    userId: 'user-2',
    name: 'Koregaon Park Loop',
    activityType: 'run',
    distance: 5400,
    duration: 1800000,
    elevationGain: 12,
    polyline:
      '73.8910,18.5350;73.8920,18.5360;73.8930,18.5375;73.8935,18.5390;73.8930,18.5405;73.8920,18.5415;73.8910,18.5420;73.8900,18.5415;73.8895,18.5400;73.8890,18.5385;73.8895,18.5365;73.8905,18.5355;73.8910,18.5350',
    territory: [
      [73.891, 18.535],
      [73.8935, 18.539],
      [73.891, 18.542],
      [73.889, 18.5385],
      [73.891, 18.535],
    ],
    territoryArea: 42000,
    createdAt: hoursAgo(5),
    kudos: ['user-1', 'user-4', 'user-5', 'user-6'],
    comments: [
      {
        id: 'c3',
        userId: 'user-5',
        text: 'Love this route! So scenic 🌳',
        createdAt: hoursAgo(4),
        likedBy: ['user-2'],
      },
      {
        id: 'c3b',
        userId: 'user-1',
        text: 'Great run Marcus! KP is the best.',
        createdAt: hoursAgo(3),
        likedBy: [],
      },
    ],
  },
  // 3. Image only — no polyline, no territory
  {
    id: 'post-3',
    userId: 'user-3',
    name: 'Post-run vibes',
    activityType: 'run',
    distance: 0,
    duration: 0,
    polyline: '',
    territory: null,
    territoryArea: 0,
    images: ['https://picsum.photos/seed/sunrise-run/800/600'],
    createdAt: daysAgo(1),
    kudos: ['user-1', 'user-2', 'user-4', 'user-6'],
    comments: [
      {
        id: 'c4',
        userId: 'user-6',
        text: 'What a view! Where is this?',
        createdAt: daysAgo(1),
        likedBy: ['user-3'],
      },
      {
        id: 'c4b',
        userId: 'user-3',
        text: 'Koregaon Park, right after sunrise 🔥',
        createdAt: daysAgo(1),
        likedBy: ['user-6'],
      },
    ],
  },
  // 4. Image + map — both photo and route, horizontally scrollable
  {
    id: 'post-4',
    userId: 'user-4',
    name: 'Evening Ride',
    activityType: 'ride',
    distance: 22500,
    duration: 3600000,
    elevationGain: 156,
    polyline:
      '73.8400,18.5000;73.8420,18.5020;73.8445,18.5045;73.8470,18.5070;73.8500,18.5100;73.8530,18.5130;73.8560,18.5160;73.8590,18.5190;73.8620,18.5220;73.8650,18.5250;73.8680,18.5280;73.8710,18.5310;73.8740,18.5340',
    territory: null,
    territoryArea: 0,
    images: [
      'https://picsum.photos/seed/evening-ride/800/600',
      'https://picsum.photos/seed/ride-sunset/800/600',
    ],
    createdAt: daysAgo(2),
    kudos: ['user-2', 'user-3', 'user-5'],
    comments: [
      {
        id: 'c5',
        userId: 'user-6',
        text: 'Nice pace! Was the traffic bad?',
        createdAt: daysAgo(2),
        likedBy: [],
      },
      {
        id: 'c6',
        userId: 'user-4',
        text: 'Not too bad, took the back roads. 🚴',
        createdAt: daysAgo(2),
        likedBy: ['user-6'],
      },
    ],
  },
];
