import type { Location } from '../types';
import type { ITrackingService } from '../types/services';
import { haversineDistance, rejectOutliers, smoothLocations } from '../utils/geo';
import { asyncStorageAdapter, type StorageAdapter } from '../utils/storage';
import { motionSensorService } from './motionSensorService';

const TRACKING_KEY = '@stryde/tracking';
const DEFAULT_STEP_LENGTH = 0.7;

export class TrackingService implements ITrackingService {
  private static instance: TrackingService;
  private isTracking = false;
  private locations: Location[] = [];
  private interpolatedLocations: Location[] = [];
  private startTime: number | null = null;
  private pausedDuration = 0;
  private pauseStartTime: number | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private storage: StorageAdapter;
  private static readonly PERSIST_INTERVAL = 5000;

  private lastGpsLocation: Location | null = null;
  private stepLength = DEFAULT_STEP_LENGTH;
  private stepsSinceLastGps = 0;
  private lastInterpolatedLocation: Location | null = null;
  private useGyroscope = true;
  private maxSpeedKmh = 25;

  private constructor(storage: StorageAdapter = asyncStorageAdapter) {
    this.storage = storage;
  }

  static getInstance(): TrackingService {
    if (!TrackingService.instance) {
      TrackingService.instance = new TrackingService();
    }
    return TrackingService.instance;
  }

  setUseGyroscope(enabled: boolean): void {
    this.useGyroscope = enabled;
  }

  setMaxSpeed(kmh: number): void {
    this.maxSpeedKmh = kmh;
  }

  async startTracking(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.isTracking = true;
    this.startTime = Date.now();
    this.locations = [];
    this.interpolatedLocations = [];
    this.pausedDuration = 0;
    this.pauseStartTime = null;
    this.lastGpsLocation = null;
    this.stepsSinceLastGps = 0;
    this.lastInterpolatedLocation = null;
    await this.persist();
  }

  async pauseTracking(): Promise<void> {
    this.isTracking = false;
    this.pauseStartTime = Date.now();
    await this.persist();
  }

  async resumeTracking(): Promise<void> {
    if (this.pauseStartTime) {
      this.pausedDuration += Date.now() - this.pauseStartTime;
      this.pauseStartTime = null;
    }
    this.isTracking = true;
    await this.persist();
  }

  async stopTracking(): Promise<void> {
    this.isTracking = false;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    await this.persist();
    this.locations = [];
    this.interpolatedLocations = [];
    this.startTime = null;
    this.pausedDuration = 0;
    this.pauseStartTime = null;
    this.lastGpsLocation = null;
    this.stepsSinceLastGps = 0;
    this.lastInterpolatedLocation = null;
    await this.storage.removeItem(TRACKING_KEY);
  }

  addLocation(location: Location): void {
    if (this.isTracking) {
      if (location.accuracy > 30) return;

      if (this.locations.length > 0) {
        const prev = this.locations[this.locations.length - 1];
        const dist = haversineDistance(
          prev.latitude,
          prev.longitude,
          location.latitude,
          location.longitude
        );
        if (dist < 5) return;
        const dt = (location.timestamp - prev.timestamp) / 1000;
        if (dt > 0 && dist / dt > this.maxSpeedKmh / 3.6) return;
      }

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

  addInterpolatedLocation(location: Location): void {
    if (this.isTracking) {
      this.interpolatedLocations.push(location);
      this.lastInterpolatedLocation = location;
    }
  }

  getInterpolatedStepDistance(): number {
    if (!this.useGyroscope || !this.lastInterpolatedLocation) return 0;
    const steps = motionSensorService.getStepCount();
    return steps * this.stepLength;
  }

  generateInterpolatedPoint(): Location | null {
    if (!this.isTracking || !this.lastGpsLocation || !this.useGyroscope) return null;

    const steps = motionSensorService.getStepCount();
    if (steps <= this.stepsSinceLastGps) return null;

    const newSteps = steps - this.stepsSinceLastGps;
    const distance = newSteps * this.stepLength;
    const heading = motionSensorService.getHeading();

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
      timestamp: Date.now(),
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
          const gap = Date.now() - data.lastPersistTime;
          const MAX_RESTORE_GAP_MS = 60_000;
          this.pausedDuration += Math.min(gap, MAX_RESTORE_GAP_MS);
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
      }
    } catch (err) {
      console.warn('[TrackingService] Failed to restore session:', err);
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

  getDistance(): number {
    const pts = smoothLocations(rejectOutliers(this.locations));
    if (pts.length < 2) return 0;

    let distance = 0;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      distance += haversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    }
    return distance;
  }

  getInterpolatedDistance(): number {
    if (!this.useGyroscope || this.interpolatedLocations.length === 0) {
      return this.getDistance();
    }

    const allPts = [...this.locations, ...this.interpolatedLocations].sort(
      (a, b) => a.timestamp - b.timestamp
    );
    const smoothed = smoothLocations(rejectOutliers(allPts));

    let distance = 0;
    for (let i = 1; i < smoothed.length; i++) {
      const prev = smoothed[i - 1];
      const curr = smoothed[i];
      distance += haversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    }

    return distance;
  }

  getDuration(): number {
    if (!this.startTime) return 0;
    const elapsed = Date.now() - this.startTime;
    const paused = this.pauseStartTime
      ? this.pausedDuration + (Date.now() - this.pauseStartTime)
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
    const cleaned = rejectOutliers(this.locations);
    const smoothed = smoothLocations(cleaned);
    return smoothed.map((loc) => `${loc.longitude},${loc.latitude}`).join(';');
  }

  generateInterpolatedPolyline(): string {
    if (!this.useGyroscope || this.interpolatedLocations.length === 0) {
      return this.generatePolyline();
    }

    const allPts = [...this.locations, ...this.interpolatedLocations].sort(
      (a, b) => a.timestamp - b.timestamp
    );
    const cleaned = rejectOutliers(allPts);
    const smoothed = smoothLocations(cleaned);
    return smoothed.map((loc) => `${loc.longitude},${loc.latitude}`).join(';');
  }

  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persist();
    }, TrackingService.PERSIST_INTERVAL);
  }

  private async persist(): Promise<void> {
    try {
      await this.storage.setItem(
        TRACKING_KEY,
        JSON.stringify({
          locations: this.locations,
          interpolatedLocations: this.interpolatedLocations,
          startTime: this.startTime,
          isTracking: this.isTracking,
          pausedDuration: this.pausedDuration,
          pauseStartTime: this.pauseStartTime,
          lastPersistTime: Date.now(),
          stepLength: this.stepLength,
          lastGpsLocation: this.lastGpsLocation,
          lastInterpolatedLocation: this.lastInterpolatedLocation,
        })
      );
    } catch (err) {
      console.error('[TrackingService] Failed to persist tracking data:', err);
    }
  }
}

export const trackingService: ITrackingService = TrackingService.getInstance();
