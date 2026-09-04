import type { Activity, Location, Ring } from './index';

export interface ITrackingService {
  startTracking(): Promise<void>;
  pauseTracking(): Promise<void>;
  resumeTracking(): Promise<void>;
  stopTracking(): Promise<void>;
  addLocation(location: Location): void;
  restoreSession(): Promise<void>;
  getLocations(): Location[];
  getDistance(): number;
  getDuration(): number;
  getIsTracking(): boolean;
  getStartTime(): number | null;
  generatePolyline(): string;
  setUseGyroscope(enabled: boolean): void;
  setMaxSpeed(kmh: number): void;
  getInterpolatedDistance(): number;
  generateInterpolatedPolyline(): string;
  generateInterpolatedPoint(): Location | null;
  addInterpolatedLocation(location: Location): void;
  getAllLocations(): Location[];
}

export interface IActivityService {
  activities: Activity[];
  saveActivity(activity: Activity): void;
  deleteActivity(id: string): void;
  updateActivity(
    id: string,
    updates: Partial<
      Pick<Activity, 'name' | 'description' | 'feel' | 'privacy' | 'images' | 'txHash'>
    >
  ): void;
  getActivityById(id: string): Activity | undefined;
  reset(): void;
  setActivities: (activities: Activity[]) => void;
}

export interface ITerritoryService {
  isClosedLoop(locations: Location[]): boolean;
  getEnclosedPolygon(locations: Location[]): Ring | null;
  getPolygonArea(ring: Ring): number;
}

export interface IProfileService {
  fetchMetadata(
    userId: string
  ): Promise<{ username?: string; firstName?: string; lastName?: string } | null>;
  updateMetadata(
    userId: string,
    metadata: { username?: string; firstName?: string; lastName?: string }
  ): Promise<boolean>;
}
