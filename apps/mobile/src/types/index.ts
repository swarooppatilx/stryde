export type ActivityType = 'run' | 'ride' | 'walk' | 'hike';

/** A closed [lng, lat] ring - first and last points equal. */
export type Ring = [number, number][];

export interface User {
  id: string;
  username: string;
  wallet: string;
  ensName?: string;
  avatar?: string;
  createdAt: Date;
}

export interface Activity {
  id: string;
  userId: string;
  name: string;
  activityType: ActivityType;
  distance: number;
  duration: number;
  polyline: string;
  /** The polygon enclosed by this run, or null if the route never closed a loop. */
  territory: Ring | null;
  /** Area of `territory` in square meters, 0 when there's no territory. */
  territoryArea: number;
  elevationGain?: number;
  image?: string;
  images?: string[];
  txHash?: string;
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
