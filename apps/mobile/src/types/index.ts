import type { ActivityType } from '@repo/shared/types';

export type { ActivityType };

export type ActivityFeel = 'great' | 'good' | 'ok' | 'bad' | 'terrible';

export type ActivityPrivacy = 'everyone' | 'followers' | 'only_me';

/** A closed [lng, lat] ring - first and last points equal. */
export type Ring = [number, number][];

export type Gender = 'man' | 'woman' | 'non_binary' | 'prefer_not_to_say';

export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  birthday: string | null;
  wallet: string;
  ensName?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  followers?: number;
  following?: number;
  createdAt: Date;
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: Date;
  likedBy: string[];
}

export interface Activity {
  id: string;
  userId: string;
  name?: string;
  activityType: ActivityType;
  distance: number;
  duration: number;
  polyline: string;
  /** The polygon enclosed by this run, or null if the route never closed a loop. */
  territory: Ring | null;
  /** Area of `territory` in square meters, 0 when there's no territory. */
  territoryArea: number;
  activityHash?: string;
  elevationGain?: number;
  image?: string;
  images?: string[];
  description?: string;
  feel?: ActivityFeel;
  privacy?: ActivityPrivacy;
  /** True when activity was entered manually (no GPS tracking). */
  isManual?: boolean;
  kudos?: string[];
  comments?: Comment[];
  txHash?: string;
  /** STRD tokens earned for this activity's distance, once the mint confirms. */
  strdEarned?: number;
  createdAt: Date;
}

export interface Territory {
  polygon: Ring;
  owner: string;
  capturedAt: Date;
}

export interface Location {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
}
