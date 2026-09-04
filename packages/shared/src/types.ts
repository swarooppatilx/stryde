export type ActivityType = 'run' | 'ride' | 'walk' | 'hike';

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
  territory: Ring | null;
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
