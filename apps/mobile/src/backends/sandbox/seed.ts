import type { ActivityType } from '@/types';
import { toPolyline } from '@/utils/format';
import type { SocialActivity, SocialUser } from '@/utils/socialSelectors';

export interface Seed {
  users: SocialUser[];
  activities: SocialActivity[];
}

const PUNE = { lat: 18.5204, lng: 73.8567 };
const DAY_MS = 86_400_000;
const hex = (n: number, width: number) => n.toString(16).padStart(width, '0');

const ATHLETES = [
  {
    n: 1,
    username: 'kavya_runs',
    firstName: 'Kavya',
    lastName: 'Iyer',
    location: 'Pune',
    followers: 24,
    following: 11,
  },
  {
    n: 2,
    username: 'nithya_rides',
    firstName: 'Nithya',
    lastName: 'Menon',
    location: 'Pune',
    followers: 18,
    following: 30,
  },
  {
    n: 3,
    username: 'meenakshi_hikes',
    firstName: 'Meenakshi',
    lastName: 'Pillai',
    location: 'Lonavala',
    followers: 41,
    following: 9,
  },
  {
    n: 4,
    username: 'rakshitha_tempo',
    firstName: 'Rakshitha',
    lastName: 'Gowda',
    location: 'Pune',
    followers: 12,
    following: 15,
  },
] as const;

/** A closed-ish loop of `points` fixes around a centre: enough shape for a route thumbnail. */
function loop(centreOffset: number, radiusDeg: number, points = 24): [number, number][] {
  return Array.from({ length: points + 1 }, (_, i) => {
    const angle = (2 * Math.PI * i) / points;
    return [
      PUNE.lng + centreOffset + radiusDeg * Math.cos(angle),
      PUNE.lat + centreOffset + radiusDeg * Math.sin(angle) * 0.8,
    ] as [number, number];
  });
}

/** Flat colour pictures, so the photo views can be tried without any real photos. */
const PHOTOS = {
  orange:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAIAAADRv8uKAAAALElEQVR4nO3NoQ0AAAgDsN3I/6cgeAE306S+2UlFZxWLxWKxWCwWi8Vi8csBP5sd+xLFKBsAAAAASUVORK5CYII=',
  teal: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAIAAADRv8uKAAAAK0lEQVR4nO3NMQ0AAAgDsIlAOzdSkQFHk/5NTZ+IWCwWi8VisVgsFov/xgtJhws7ySiLIAAAAABJRU5ErkJggg==',
  purple:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAIAAADRv8uKAAAAK0lEQVR4nO3NMQ0AAAgDsKlDExKRhQw4mvRvuuZExGKxWCwWi8VisVj8N16tjCSKrw9fbAAAAABJRU5ErkJggg==',
} as const;

interface SeedPost {
  by: number;
  type: ActivityType;
  name: string;
  km: number;
  min: number;
  daysAgo: number;
  kudosBy: readonly number[];
  comment: { by: number; text: string } | null;
  photos?: readonly (keyof typeof PHOTOS)[];
}

const POSTS: readonly SeedPost[] = [
  {
    by: 0,
    type: 'run',
    name: 'Morning tempo',
    km: 8.2,
    min: 41,
    daysAgo: 1,
    kudosBy: [1, 2],
    comment: { by: 1, text: 'Strong pace today!' },
  },
  {
    by: 1,
    type: 'ride',
    name: 'Sunday ride to Sinhagad',
    km: 32.5,
    min: 96,
    daysAgo: 2,
    kudosBy: [0],
    comment: null,
  },
  {
    by: 2,
    type: 'hike',
    name: 'Rajmachi trail',
    km: 14.1,
    min: 210,
    daysAgo: 4,
    kudosBy: [],
    comment: null,
  },
  {
    by: 3,
    type: 'run',
    name: 'Track intervals',
    km: 6.0,
    min: 28,
    daysAgo: 5,
    kudosBy: [0, 1, 2],
    comment: { by: 0, text: 'Those splits though' },
  },
  {
    by: 0,
    type: 'run',
    name: 'Riverside photo run',
    km: 5.4,
    min: 34,
    daysAgo: 0.5,
    kudosBy: [],
    comment: null,
    photos: ['orange', 'teal', 'purple'],
  },
  {
    by: 1,
    type: 'ride',
    name: 'Sunset ride',
    km: 18.2,
    min: 52,
    daysAgo: 3,
    kudosBy: [],
    comment: null,
    photos: ['teal'],
  },
];

/** Other athletes and their recent posts, for a profile with no chain to read them from. Same output for the same `now`. */
export function buildSeed(now: number): Seed {
  const users: SocialUser[] = ATHLETES.map((a) => {
    const id = `0x${hex(a.n, 40)}`;
    return {
      id,
      wallet: id,
      username: a.username,
      firstName: a.firstName,
      lastName: a.lastName,
      gender: 'prefer_not_to_say',
      birthday: null,
      location: a.location,
      isVerified: a.n % 2 === 1,
      followers: a.followers,
      following: a.following,
      createdAt: new Date(now - 90 * DAY_MS),
    };
  });

  const activities: SocialActivity[] = POSTS.map((p, i) => {
    const author = users[p.by];
    if (!author) throw new Error('seed post has no author');
    const createdAt = new Date(now - p.daysAgo * DAY_MS);
    const id = `0x${hex(0xa000 + i, 64)}`;
    return {
      id,
      userId: author.id,
      name: p.name,
      activityType: p.type,
      distance: Math.round(p.km * 1000),
      duration: p.min * 60_000,
      polyline: toPolyline(loop(i * 0.004, 0.004 + i * 0.0006)),
      territory: null,
      territoryArea: 0,
      privacy: 'everyone',
      createdAt,
      activityHash: id,
      images: p.photos?.map((name) => PHOTOS[name]),
      activityId: String(100 + i),
      onchainActivityId: String(100 + i),
      txHash: `0x${hex(0xb000 + i, 64)}`,
      kudos: p.kudosBy.map((k) => users[k]?.id ?? '').filter(Boolean),
      comments: p.comment
        ? [
            {
              id: `0x${hex(0xc000 + i, 64)}`,
              userId: users[p.comment.by]?.id ?? author.id,
              text: p.comment.text,
              createdAt: new Date(createdAt.getTime() + 3_600_000),
              likedBy: [],
            },
          ]
        : [],
    };
  });

  return { users, activities };
}

interface SocialSlice {
  users: Record<string, SocialUser>;
  activities: Record<string, SocialActivity>;
}

/** Adds what the seed has and the store lacks. Anything already there (including local edits) is kept as it is. */
export function mergeSeed(current: SocialSlice, seed: Seed): SocialSlice {
  const users = { ...current.users };
  for (const user of seed.users) if (!users[user.id]) users[user.id] = user;
  const activities = { ...current.activities };
  for (const activity of seed.activities) {
    const key = activity.id.toLowerCase();
    if (!activities[key]) activities[key] = activity;
  }
  return { users, activities };
}
