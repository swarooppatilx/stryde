export type ActivityType =
  | 'run'
  | 'ride'
  | 'walk'
  | 'hike'
  | 'swim'
  | 'yoga'
  | 'workout'
  | 'hiit'
  | 'dance'
  | 'climb'
  | 'skate'
  | 'row';

export type Ring = [number, number][];

export interface Territory {
  polygon: Ring;
  owner: string;
  capturedAt: Date;
}

export interface Location {
  latitude: number;
  longitude: number;
  timestamp: number;
  /** Horizontal accuracy in meters. */
  accuracy: number;
  /** Ground speed in m/s from the GPS chip, when it reports one. */
  speed?: number;
  /** Meters above sea level. */
  altitude?: number;
  /** Direction of travel in degrees (0-360). */
  bearing?: number;
  /** Vertical accuracy in meters. */
  verticalAccuracy?: number;
  /** True when the phone says this position was simulated (Android mock location), not measured. */
  mocked?: boolean;
}
