import type { ActivityType, Lap } from '@/types';

export interface TrackPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  /** Milliseconds since the epoch; absent when the point has no readable time. */
  timestamp?: number;
  /** Beats per minute. */
  heartRate?: number;
  /** Strides or revolutions per minute, as the file gives them. */
  cadence?: number;
}

/** One recorded activity read from a file, before it is turned into an Activity. */
export interface ImportedTrack {
  name?: string;
  sport: ActivityType;
  points: TrackPoint[];
  /** The laps the device marked, when the file has them. */
  laps?: Lap[];
}
