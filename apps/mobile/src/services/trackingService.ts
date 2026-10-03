import { type Clock, lazyService, type MotionSensors, type StorageAdapter } from '@/platform';
import type { Location } from '@/types';
import type { FixRejections, ITrackingService } from '@/types/services';
import {
  classifyFix,
  type FixClass,
  MAX_FIX_ACCURACY_M,
  MIN_PLAUSIBLE_FIX_TIME_MS,
} from '@/utils/fixClassifier';
import { haversineDistance, rejectOutliers, smoothLocations } from '@/utils/geo';
import { IncrementalTrack } from '@/utils/incrementalTrack';
import { logger } from '@/utils/logger';
import { createMotionDetector } from '@/utils/motionPause';
import { pairs } from '@/utils/pairs';
import { TRACKING_STORAGE_KEY } from '@/utils/recoverableRun';

const TRACKING_KEY = TRACKING_STORAGE_KEY;
const DEFAULT_STEP_LENGTH = 0.7;
/** An activity this brief (and this still) is an accidental start, not a workout. */
const MIN_ACTIVITY_MS = 5000;
const MIN_ACTIVITY_DISTANCE_M = 10;
/** After the app is killed mid-run, at most this much of the downtime still counts as active. */
const MAX_RESTORE_ACTIVE_GAP_MS = 60_000;

function pathLength(points: Location[]): number {
  let total = 0;
  for (const [from, to] of pairs(points)) {
    total += haversineDistance(from.latitude, from.longitude, to.latitude, to.longitude);
  }
  return total;
}

function toPolyline(points: Location[]): string {
  return points.map((p) => `${p.longitude},${p.latitude}`).join(';');
}

const REJECTION_OF_VERDICT: Record<Exclude<FixClass, 'accept'>, keyof FixRejections> = {
  'ignore-accuracy': 'accuracy',
  'ignore-clock': 'clock',
  'ignore-backwards': 'duplicate',
  'ignore-jitter': 'duplicate',
  'ignore-teleport': 'speed',
  'ignore-acceleration': 'acceleration',
};

const noRejections = (): FixRejections => ({
  accuracy: 0,
  speed: 0,
  acceleration: 0,
  clock: 0,
  duplicate: 0,
});

export interface TrackingDeps {
  storage: StorageAdapter;
  clock: Clock;
  motion: Pick<MotionSensors, 'getStepCount' | 'getHeading'>;
}

export class TrackingService implements ITrackingService {
  private isTracking = false;
  private locations: Location[] = [];
  private interpolatedLocations: Location[] = [];
  private startTime: number | null = null;
  private pausedDuration = 0;
  private pauseStartTime: number | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private activityType: string | null = null;
  private readonly storage: StorageAdapter;
  private readonly clock: Clock;
  private readonly motion: TrackingDeps['motion'];
  private static readonly PERSIST_INTERVAL = 5000;
  /** Runs and walks: below walking pace for this long pauses (the accelerometer usually gets there first). */
  private static readonly AUTO_PAUSE_SPEED_MS = 1;
  private static readonly AUTO_PAUSE_HOLD_MS = 5000;
  /** Rides and other sports pause only when really stopped, so a slow climb keeps recording. */
  private static readonly STOPPED_SPEED_MS = 0.33;
  private static readonly STOPPED_HOLD_MS = 10_000;
  private static readonly AUTO_PAUSE_RESUME_MOVE_M = 2;
  /** Silence from the GPS this long while recording counts as a lost signal. */
  private static readonly SIGNAL_LOSS_MS = 10_000;
  /**
   * Runs and walks pause below walking pace. A hike's slow climb is below it for long stretches, so
   * hikes take the "really stopped" thresholds like rides.
   */
  private static readonly PACE_PAUSE_SPORTS = new Set(['run', 'walk']);
  /** Only sports where the phone moves with the athlete use the accelerometer to pause. */
  private static readonly MOTION_PAUSE_SPORTS = new Set(['run', 'walk', 'hike']);
  /** The phone must stay still this long before the run pauses. */
  private static readonly MOTION_STILL_HOLD_MS = 4_000;
  /** No motion pause in the first seconds, while the detector is still learning what running looks like. */
  private static readonly MOTION_PAUSE_AFTER_MS = 10_000;
  /** If the GPS chip still reports at least this speed (m/s), the athlete is moving whatever the phone says. */
  private static readonly GPS_MOVING_MS = 1.5;
  /** The auto-pause decision trusts the chip's speed this long; the on-screen live speed uses its own, much shorter window. */
  private static readonly AUTO_PAUSE_SPEED_FRESH_MS = 15_000;

  private lastGpsLocation: Location | null = null;
  /** Newest fix seen, recorded or not; older ones are replays/out-of-order and ignored. */
  private lastFixTimestamp = 0;
  private stepLength = DEFAULT_STEP_LENGTH;
  private stepsSinceLastGps = 0;
  private lastInterpolatedLocation: Location | null = null;
  private useGyroscope = true;
  private maxSpeedKmh = 25;
  private distanceTrack: IncrementalTrack | null = null;
  private distanceSource: Location[] | null = null;
  private distanceMaxSpeedKmh = 0;
  /** Jumps rejected in a row, so a track that really moved on is not rejected forever. */
  private teleportRejects = 0;
  private rejections = noRejections();
  private autoPauseEnabled = false;
  private readonly motionDetector = createMotionDetector();
  private motionStillSince: number | null = null;
  /** The GPS chip's latest speed, kept from any fix good enough to trust, even one the track ignores. */
  private lastSpeedReading: { speed: number; at: number } | null = null;
  /** Set while the current auto-pause came from the accelerometer, so only movement lifts it. */
  private pausedByMotion = false;
  private autoPaused = false;
  private lowSpeedSince: number | null = null;
  private pauseLocation: Location | null = null;
  /** The fix before the current one while auto-paused: resume is judged on the speed between two fixes, not on the whole pause. */
  private lastPausedFix: Location | null = null;

  constructor({ storage, clock, motion }: TrackingDeps) {
    this.storage = storage;
    this.clock = clock;
    this.motion = motion;
  }

  setUseGyroscope(enabled: boolean): void {
    this.useGyroscope = enabled;
  }

  setMaxSpeed(kmh: number): void {
    this.maxSpeedKmh = kmh;
  }

  setAutoPauseEnabled(enabled: boolean): void {
    this.autoPauseEnabled = enabled;
    if (!enabled) {
      this.lowSpeedSince = null;
      this.autoPaused = false;
    }
  }

  getIsAutoPaused(): boolean {
    return this.autoPaused;
  }

  getActivityType(): string | null {
    return this.activityType;
  }

  async startTracking(activityType?: string): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.isTracking = true;
    this.clearSession();
    this.activityType = activityType ?? null;
    this.startTime = this.clock.now();
    this.autoPaused = false;
    this.lowSpeedSince = null;
    this.pauseLocation = null;
    await this.persist();
  }

  async pauseTracking(): Promise<void> {
    this.pausedByMotion = false;
    this.autoPaused = false;
    this.lowSpeedSince = null;
    this.isTracking = false;
    this.pauseStartTime = this.clock.now();
    await this.persist();
  }

  async resumeTracking(): Promise<void> {
    this.pausedByMotion = false;
    this.autoPaused = false;
    this.pauseLocation = null;
    this.lowSpeedSince = null;
    if (this.pauseStartTime) {
      this.pausedDuration += this.clock.now() - this.pauseStartTime;
      this.pauseStartTime = null;
    }
    this.isTracking = true;
    await this.persist();
  }

  async stopTracking(): Promise<{ success: boolean; error?: string }> {
    this.autoPaused = false;
    this.lowSpeedSince = null;
    this.pauseLocation = null;
    this.isTracking = false;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }

    const tooShort =
      this.getDistance() < MIN_ACTIVITY_DISTANCE_M && this.getDuration() < MIN_ACTIVITY_MS;

    // Either way the session is over: a rejected attempt must not linger in
    // memory or storage to be "restored" into the next launch.
    this.clearSession();
    await this.storage.removeItem(TRACKING_KEY);

    return tooShort
      ? {
          success: false,
          error: 'Activity too short — walked less than 10m in under 5 seconds',
        }
      : { success: true };
  }

  private clearSession(): void {
    this.locations = [];
    this.interpolatedLocations = [];
    this.activityType = null;
    this.startTime = null;
    this.pausedDuration = 0;
    this.pauseStartTime = null;
    this.lastGpsLocation = null;
    this.lastFixTimestamp = 0;
    this.teleportRejects = 0;
    this.rejections = noRejections();
    this.motionDetector.reset();
    this.motionStillSince = null;
    this.lastSpeedReading = null;
    this.pausedByMotion = false;
    this.stepsSinceLastGps = 0;
    this.lastInterpolatedLocation = null;
  }

  /** How many fixes this session ignored, by reason: counts only, nothing about where. */
  getRejections(): FixRejections {
    return { ...this.rejections };
  }

  private reject(reason: keyof FixRejections): void {
    if (this.isTracking) this.rejections[reason]++;
  }

  addLocation(location: Location): void {
    if (location.timestamp < MIN_PLAUSIBLE_FIX_TIME_MS) {
      this.reject('clock');
      return;
    }
    if (location.accuracy > MAX_FIX_ACCURACY_M) {
      this.reject('accuracy');
      return;
    }
    if (location.speed !== undefined) {
      this.lastSpeedReading = { speed: location.speed, at: this.clock.now() };
    }
    // Buffered background fixes are replayed after the fact; anything not newer
    // than what was already seen would walk the route backwards.
    if (location.timestamp <= this.lastFixTimestamp) {
      this.reject('duplicate');
      return;
    }
    this.lastFixTimestamp = location.timestamp;
    this.updateAutoPause(location);

    if (this.isTracking) {
      const verdict = classifyFix(location, this.locations.at(-1), {
        maxSpeedMs: this.maxSpeedKmh / 3.6,
        consecutiveTeleports: this.teleportRejects,
        beforePrevious: this.locations.at(-2),
      });
      if (verdict === 'ignore-teleport' || verdict === 'ignore-acceleration') {
        this.teleportRejects++;
        logger.debug(`[Tracking] Ignored a jump (${this.teleportRejects} in a row)`);
      }
      if (verdict !== 'accept') {
        this.reject(REJECTION_OF_VERDICT[verdict]);
        return;
      }
      this.teleportRejects = 0;

      this.locations.push(location);
      this.lastGpsLocation = location;

      if (this.useGyroscope && this.stepsSinceLastGps > 0) {
        const actualDistance = this.lastInterpolatedLocation
          ? haversineDistance(
              this.lastInterpolatedLocation.latitude,
              this.lastInterpolatedLocation.longitude,
              location.latitude,
              location.longitude
            )
          : 0;

        if (actualDistance > 0 && this.stepsSinceLastGps > 0) {
          this.stepLength = actualDistance / this.stepsSinceLastGps;
          this.stepLength = Math.max(0.3, Math.min(1.0, this.stepLength));
        }
      }

      this.stepsSinceLastGps = 0;
      this.lastInterpolatedLocation = location;
      this.schedulePersist();
    }
  }

  /**
   * One reading of the phone's acceleration (in g). While a run, walk or hike is being recorded, a phone that stays
   * still for a few seconds pauses it, unless the GPS chip says the athlete is still moving; the next movement
   * resumes a pause that came from here. GPS-speed pausing and the signal watchdog keep working beside it.
   */
  addAccelerationSample(magnitudeG: number): void {
    if (!this.autoPauseEnabled) return;
    const now = this.clock.now();
    const state = this.motionDetector.update(magnitudeG, now);

    if (this.autoPaused && this.pausedByMotion) {
      if (state === 'moving') void this.resumeTracking();
      return;
    }
    if (!this.isTracking || !this.usesMotionPause()) {
      this.motionStillSince = null;
      return;
    }
    if (state !== 'still') {
      this.motionStillSince = null;
      return;
    }
    const stillSince = this.motionStillSince ?? now;
    this.motionStillSince = stillSince;
    if (now - stillSince < TrackingService.MOTION_STILL_HOLD_MS) return;
    if (now - (this.startTime ?? now) < TrackingService.MOTION_PAUSE_AFTER_MS) return;

    const last = this.lastGpsLocation;
    if (!last) return;
    // Judge by the freshest speed the chip reported, even from fixes ignored as standing jitter.
    const reading = this.lastSpeedReading;
    if (
      reading &&
      now - reading.at < TrackingService.AUTO_PAUSE_SPEED_FRESH_MS &&
      reading.speed >= TrackingService.GPS_MOVING_MS
    ) {
      return;
    }

    this.autoPauseAt(last);
    this.pausedByMotion = true;
    this.motionStillSince = null;
  }

  private usesMotionPause(): boolean {
    return this.activityType === null || TrackingService.MOTION_PAUSE_SPORTS.has(this.activityType);
  }

  private autoPauseAt(location: Location): void {
    void this.pauseTracking();
    this.autoPaused = true;
    this.pauseLocation = location;
    this.lastPausedFix = null;
    this.lowSpeedSince = null;
    void this.persist();
  }

  /**
   * Fixes only arrive when the GPS has one, so a tunnel or a dead receiver would otherwise leave
   * the run "recording" with a frozen position. Called on a clock: once the silence passes the
   * limit the run auto-pauses at the last known position and resumes with the next fix that shows
   * real movement. Before the first fix there is nothing to pause, so a slow lock is left alone.
   */
  checkSignalLoss(): void {
    if (!this.autoPauseEnabled || !this.isTracking || !this.lastGpsLocation) return;
    if (this.clock.now() - this.lastFixTimestamp < TrackingService.SIGNAL_LOSS_MS) return;
    this.autoPauseAt(this.lastGpsLocation);
  }

  private usesPacePause(): boolean {
    return this.activityType === null || TrackingService.PACE_PAUSE_SPORTS.has(this.activityType);
  }

  private autoPauseSpeedMs(): number {
    return this.usesPacePause()
      ? TrackingService.AUTO_PAUSE_SPEED_MS
      : TrackingService.STOPPED_SPEED_MS;
  }

  private autoPauseHoldMs(): number {
    return this.usesPacePause()
      ? TrackingService.AUTO_PAUSE_HOLD_MS
      : TrackingService.STOPPED_HOLD_MS;
  }

  private updateAutoPause(location: Location): void {
    if (!this.autoPauseEnabled) return;

    if (this.autoPaused) {
      if (!this.pauseLocation) return;
      const moved = haversineDistance(
        this.pauseLocation.latitude,
        this.pauseLocation.longitude,
        location.latitude,
        location.longitude
      );
      // Speed between this fix and the one before it. Dividing the distance from the pause point by the
      // time since the pause made a runner at 3 m/s look like 0.05 m/s after a minute standing, so a
      // longer stop took longer to resume from.
      const prev = this.lastPausedFix ?? this.pauseLocation;
      const dt = (location.timestamp - prev.timestamp) / 1000;
      const stepSpeed =
        dt > 0
          ? haversineDistance(
              prev.latitude,
              prev.longitude,
              location.latitude,
              location.longitude
            ) / dt
          : 0;
      this.lastPausedFix = location;
      if (
        stepSpeed > this.autoPauseSpeedMs() &&
        moved >= TrackingService.AUTO_PAUSE_RESUME_MOVE_M
      ) {
        this.autoPaused = false;
        this.pauseLocation = null;
        this.lastPausedFix = null;
        this.lowSpeedSince = null;
        void this.resumeTracking();
      }
      return;
    }

    if (!this.isTracking || !this.lastGpsLocation) return;

    const prev = this.lastGpsLocation;
    const dt = (location.timestamp - prev.timestamp) / 1000;
    const speed =
      dt > 0
        ? haversineDistance(prev.latitude, prev.longitude, location.latitude, location.longitude) /
          dt
        : 0;

    if (speed < this.autoPauseSpeedMs()) {
      this.lowSpeedSince ??= location.timestamp;
      if (location.timestamp - this.lowSpeedSince >= this.autoPauseHoldMs()) {
        this.autoPauseAt(location);
      }
    } else {
      this.lowSpeedSince = null;
    }
  }

  addInterpolatedLocation(location: Location): void {
    if (this.isTracking) {
      this.interpolatedLocations.push(location);
      this.lastInterpolatedLocation = location;
    }
  }

  getInterpolatedStepDistance(): number {
    if (!this.useGyroscope || !this.lastInterpolatedLocation) return 0;
    const steps = this.motion.getStepCount();
    return steps * this.stepLength;
  }

  generateInterpolatedPoint(): Location | null {
    if (!this.isTracking || !this.lastGpsLocation || !this.useGyroscope) return null;

    const steps = this.motion.getStepCount();
    if (steps <= this.stepsSinceLastGps) return null;

    const newSteps = steps - this.stepsSinceLastGps;
    const distance = newSteps * this.stepLength;
    const heading = this.motion.getHeading();

    const R = 6371e3;
    const lat1 =
      ((this.lastInterpolatedLocation?.latitude ?? this.lastGpsLocation.latitude) * Math.PI) / 180;

    const dLat = (distance * Math.cos(heading)) / R;
    const dLng = (distance * Math.sin(heading)) / (R * Math.cos(lat1));

    const newLat =
      (this.lastInterpolatedLocation?.latitude ?? this.lastGpsLocation.latitude) +
      (dLat * 180) / Math.PI;
    const newLng =
      (this.lastInterpolatedLocation?.longitude ?? this.lastGpsLocation.longitude) +
      (dLng * 180) / Math.PI;

    this.stepsSinceLastGps = steps;

    return {
      latitude: newLat,
      longitude: newLng,
      timestamp: this.clock.now(),
      accuracy: 0,
    };
  }

  async restoreSession(): Promise<void> {
    try {
      const stored = await this.storage.getItem(TRACKING_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (Array.isArray(data.locations)) {
          this.locations = data.locations;
        }
        if (Array.isArray(data.interpolatedLocations)) {
          this.interpolatedLocations = data.interpolatedLocations;
        }
        if (typeof data.activityType === 'string') {
          this.activityType = data.activityType;
        }
        if (typeof data.startTime === 'number') {
          this.startTime = data.startTime;
        }
        this.isTracking = data.isTracking === true;
        if (typeof data.pausedDuration === 'number') {
          this.pausedDuration = data.pausedDuration;
        }
        if (typeof data.pauseStartTime === 'number') {
          this.pauseStartTime = data.pauseStartTime;
        }
        if (this.isTracking && typeof data.lastPersistTime === 'number') {
          // A quick relaunch keeps all its time; a long one only gets a minute,
          // not the hours the app spent dead.
          const gap = this.clock.now() - data.lastPersistTime;
          this.pausedDuration += Math.max(0, gap - MAX_RESTORE_ACTIVE_GAP_MS);
        }
        if (typeof data.stepLength === 'number') {
          this.stepLength = data.stepLength;
        }
        if (data.lastGpsLocation) {
          this.lastGpsLocation = data.lastGpsLocation;
        }
        if (data.lastInterpolatedLocation) {
          this.lastInterpolatedLocation = data.lastInterpolatedLocation;
        }
        if (typeof data.autoPaused === 'boolean') {
          this.autoPaused = data.autoPaused;
        }
        if (data.pauseLocation) {
          this.pauseLocation = data.pauseLocation;
        }
        this.lastFixTimestamp = Math.max(
          this.locations[this.locations.length - 1]?.timestamp ?? 0,
          this.lastGpsLocation?.timestamp ?? 0,
          this.pauseLocation?.timestamp ?? 0
        );
      }
    } catch (err) {
      logger.warn('[TrackingService] Failed to restore session:', err);
      await this.storage.removeItem(TRACKING_KEY);
    }
  }

  getLocations(): Location[] {
    return [...this.locations];
  }

  getAllLocations(): Location[] {
    return [...this.locations, ...this.interpolatedLocations].sort(
      (a, b) => a.timestamp - b.timestamp
    );
  }

  /**
   * Distance so far, kept up to date fix by fix. Cleaning and re-adding the whole track on every
   * tick made a long run quadratic; this gives the same number for a fixed cost per fix.
   */
  getDistance(): number {
    const locations = this.locations;
    if (
      !this.distanceTrack ||
      this.distanceSource !== locations ||
      this.distanceMaxSpeedKmh !== this.maxSpeedKmh ||
      this.distanceTrack.fed > locations.length
    ) {
      // A different array (a new run, or one restored after the app was killed) or a different
      // speed limit: start again from what is there.
      this.distanceTrack = new IncrementalTrack(this.maxSpeedKmh / 3.6);
      this.distanceSource = locations;
      this.distanceMaxSpeedKmh = this.maxSpeedKmh;
    }
    for (let i = this.distanceTrack.fed; i < locations.length; i++) {
      this.distanceTrack.add(locations[i] as Location);
    }
    return this.distanceTrack.length;
  }

  getInterpolatedDistance(): number {
    if (!this.useGyroscope || this.interpolatedLocations.length === 0) {
      return this.getDistance();
    }
    return pathLength(this.cleanTrack(this.getAllLocations()));
  }

  getDuration(): number {
    if (!this.startTime) return 0;
    const elapsed = this.clock.now() - this.startTime;
    const paused = this.pauseStartTime
      ? this.pausedDuration + (this.clock.now() - this.pauseStartTime)
      : this.pausedDuration;
    return elapsed - paused;
  }

  getIsTracking(): boolean {
    return this.isTracking;
  }

  getStartTime(): number | null {
    return this.startTime;
  }

  generatePolyline(): string {
    return toPolyline(this.cleanTrack(this.locations));
  }

  generateInterpolatedPolyline(): string {
    if (!this.useGyroscope || this.interpolatedLocations.length === 0) {
      return this.generatePolyline();
    }
    return toPolyline(this.cleanTrack(this.getAllLocations()));
  }

  /** Outliers out (judged against this activity's own speed limit), then smoothed. */
  private cleanTrack(points: Location[]): Location[] {
    return smoothLocations(rejectOutliers(points, { maxSpeedMs: this.maxSpeedKmh / 3.6 }));
  }

  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persist();
    }, TrackingService.PERSIST_INTERVAL);
  }

  private async persist(): Promise<void> {
    try {
      await this.storage.setItem(
        TRACKING_KEY,
        JSON.stringify({
          locations: this.locations,
          interpolatedLocations: this.interpolatedLocations,
          activityType: this.activityType,
          startTime: this.startTime,
          isTracking: this.isTracking,
          pausedDuration: this.pausedDuration,
          pauseStartTime: this.pauseStartTime,
          lastPersistTime: this.clock.now(),
          stepLength: this.stepLength,
          lastGpsLocation: this.lastGpsLocation,
          lastInterpolatedLocation: this.lastInterpolatedLocation,
          autoPaused: this.autoPaused,
          pauseLocation: this.pauseLocation,
        })
      );
    } catch (err) {
      logger.error('[TrackingService] Failed to persist tracking data:', err);
    }
  }
}

export function createTrackingService(deps: TrackingDeps): TrackingService {
  return new TrackingService(deps);
}

/** The app-wide service: built on first use from the installed platform. */
export const trackingService: ITrackingService = lazyService(({ storage, clock, motion }) =>
  createTrackingService({ storage, clock, motion })
);
