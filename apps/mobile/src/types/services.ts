import type { Activity, Location, Ring } from './index';

/** Fixes a recording ignored, by reason. Counts only. */
export type FixRejections = {
  accuracy: number;
  speed: number;
  acceleration: number;
  clock: number;
  duplicate: number;
};

export interface ITrackingService {
  startTracking(activityType?: string): Promise<void>;
  getActivityType(): string | null;
  pauseTracking(): Promise<void>;
  resumeTracking(): Promise<void>;
  stopTracking(): Promise<{ success: boolean; error?: string }>;
  /** `stepsAtFix` is the pedometer total when the fix was taken, for fixes handled after a delay. */
  addLocation(location: Location, stepsAtFix?: number): void;
  setFilterFixes(enabled: boolean): void;
  restoreSession(): Promise<void>;
  getLocations(): Location[];
  getDistance(): number;
  getDuration(): number;
  getIsTracking(): boolean;
  getStartTime(): number | null;
  generatePolyline(): string;
  setUseGyroscope(enabled: boolean): void;
  setMaxSpeed(kmh: number): void;
  setAutoPauseEnabled(enabled: boolean): void;
  getIsAutoPaused(): boolean;
  /** Auto-pauses when the GPS has been silent too long; call it on a clock while recording. */
  checkSignalLoss(): void;
  /** One reading of the phone's acceleration in g; may pause or resume a run that has gone still. */
  addAccelerationSample(magnitudeG: number): void;
  getInterpolatedDistance(): number;
  /** Meters walked by the pedometer since the last route point, which the next fix has not measured yet. */
  getInterpolatedStepDistance(): number;
  generateInterpolatedPolyline(): string;
  generateInterpolatedPoint(): Location | null;
  addInterpolatedLocation(location: Location): void;
  getAllLocations(): Location[];
  getRejections(): FixRejections;
}

export interface IActivityService {
  activities: Activity[];
  saveActivity(activity: Activity): void;
  deleteActivity(id: string): void;
  updateActivity(
    id: string,
    updates: Partial<
      Pick<
        Activity,
        | 'name'
        | 'description'
        | 'feel'
        | 'effort'
        | 'isCommute'
        | 'privateNote'
        | 'privacy'
        | 'images'
        | 'elevationGain'
        | 'txHash'
        | 'strdEarned'
        | 'rewardHold'
        | 'onchainActivityId'
        | 'metadataCid'
        | 'gearId'
        | 'sweat'
        | 'steps'
        | 'segmentEfforts'
        | 'swarmRef'
        | 'swarmLink'
      >
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
