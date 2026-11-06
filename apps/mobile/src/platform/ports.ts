import type { AccuracyMode } from '@/stores/settingsStore';
import type { ActivityType, Location } from '@/types';

/**
 * Everything the app's logic needs from the device, as small interfaces. Services depend on these, never on
 * expo-* modules, so the same code runs against platform/expo or scripted platform/fakes in plain vitest.
 */

export interface Clock {
  now(): number;
}

export interface IdGenerator {
  next(): string;
}

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface Subscription {
  remove(): void;
}

export interface LocationPermission {
  granted: boolean;
  /**
   * False when only approximate location was allowed (Android 12 and later): fixes are too coarse
   * to record a route. Absent means precise.
   */
  precise?: boolean;
  /** False once the OS will no longer show its prompt (user must use Settings). */
  canAskAgain: boolean;
}

export interface WatchOptions {
  accuracy: AccuracyMode;
  timeIntervalMs: number;
  distanceIntervalM: number;
}

/** Foreground GPS. Fixes use the app's own `Location` shape, never an Expo type. */
export interface LocationSource {
  getPermission(): Promise<LocationPermission>;
  requestPermission(): Promise<LocationPermission>;
  watch(options: WatchOptions, onFix: (fix: Location) => void): Promise<Subscription>;
  getCurrent(accuracy: AccuracyMode): Promise<Location>;
  getLastKnown(): Promise<Location | null>;
  /** Opens the OS settings page where the user can re-enable location. */
  /** Whether the phone's location services are switched on; with them off no fix can arrive. */
  servicesEnabled(): Promise<boolean>;
  openSettings(): Promise<void>;
}

/** GPS that keeps recording while the app is backgrounded, buffering fixes for later. */
export interface BackgroundLocation {
  /** Resolves false when it can't run (no permission, web) so callers degrade to foreground-only. */
  start(mode: AccuracyMode, activityName: string): Promise<boolean>;
  /**
   * Re-runs the "allow all the time" ask from the in-run banner: opens the OS
   * location-permission page (or the grant dialog), not plain App Info, because
   * App Info buries Permissions → Location two taps deeper.
   */
  requestPermission(): Promise<void>;
  stop(): Promise<void>;
  /** Buffered fixes, oldest first, without removing them. */
  peek(): Promise<Location[]>;
  clear(): Promise<void>;
}

export interface MotionSensors {
  start(options?: { rate?: 10 | 50; onUpdate?: () => void }): Promise<void>;
  stop(): void;
  resetSteps(): void;
  isAvailable(): boolean;
  getStepCount(): number;
  getHeading(): number;
  isMoving(): boolean;
  /** Raw acceleration magnitude in g, for every accelerometer reading while running. Returns the unsubscribe. */
  subscribeAcceleration(listener: (magnitudeG: number) => void): () => void;
}

export interface Connectivity {
  isOnline(): Promise<boolean>;
  subscribe(onChange: (online: boolean) => void): Subscription;
}

export interface Haptics {
  tap(): void;
  impactMedium(): void;
  impactHeavy(): void;
  selection(): void;
  success(): void;
  warning(): void;
  error(): void;
}

/** Speaks a short line aloud, e.g. a split announcement during a run. */
export interface Speaker {
  speak(text: string): void;
  /** Cuts off anything still being said. */
  stop(): void;
}

/** Keeps the display from sleeping, so a run on a table or a bike mount stays on screen. */
export interface ScreenAwake {
  keepAwake(on: boolean): void;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
}

/** Ask the user a yes/no question. Resolves false when dismissed. */
export interface Prompter {
  confirm(options: ConfirmOptions): Promise<boolean>;
}

/** Place names to coordinates and back (OS geocoder). */
export interface Geocoder {
  geocode(query: string): Promise<Array<{ latitude: number; longitude: number }>>;
  /** A readable name for a point, or null when the OS has none. */
  placeName(latitude: number, longitude: number): Promise<string | null>;
}

export interface Clipboard {
  copyText(text: string): Promise<void>;
  readText(): Promise<string>;
}

export interface PickOptions {
  multiple?: boolean;
  /** Most photos to accept when `multiple`. */
  limit?: number;
  /** Crop to this aspect ratio (single photo only). */
  aspect?: [number, number];
}

/** The photo library. Asks for access first; `denied` when the user refuses it. */
export interface PhotoLibrary {
  pick(options?: PickOptions): Promise<{ status: 'denied' } | { status: 'picked'; uris: string[] }>;
}

/** Local files by `file://` URI: reading picked photos, writing temp files to hand to the share sheet. */
export interface Files {
  /** Size in bytes, or null when nothing exists at `uri`. */
  size(uri: string): Promise<number | null>;
  readBase64(uri: string): Promise<string>;
  readText(uri: string): Promise<string>;
  readBytes(uri: string): Promise<Uint8Array>;
  /** Writes into the app's cache directory (the OS may clear it) and returns the new file's URI. */
  writeCache(name: string, content: string, encoding?: 'utf8' | 'base64'): string;
}

/** A finished workout recorded by another app or a watch and kept in the phone's health data. */
export interface HealthWorkout {
  /** Stable id from the health data: importing the same workout twice must be recognisable. */
  id: string;
  sport: ActivityType;
  /** Milliseconds since the epoch. */
  startTime: number;
  endTime: number;
  distanceM: number;
  title?: string;
  /** Average and highest heart rate (bpm) and the readings behind them, when the watch recorded them. */
  heartRate?: {
    avg: number;
    max: number;
    /** Seconds since the workout began, and beats per minute at each. */
    series: { t: number[]; bpm: number[] };
  };
  /** Calories the watch worked out, in kcal. */
  calories?: number;
  /** The route the watch recorded, when there was one and the athlete allowed it to be read. */
  route?: Array<{ latitude: number; longitude: number; altitude?: number; timestamp: number }>;
}

/** What the health data holds about the body: the latest of each, only those that are plausible. */
export interface HealthBody {
  weightKg?: number;
  heightCm?: number;
  restingHeartRate?: number;
}

/** `update-required`: the health provider is installed but too old to use. */
export type HealthStatus = 'available' | 'unavailable' | 'update-required';

/** The phone's health data (Health Connect on Android), read-only: workouts to import. */
export interface HealthSource {
  status(): Promise<HealthStatus>;
  /** Whether read access has already been granted. */
  hasAccess(): Promise<boolean>;
  /** Shows the system permission screen; true when read access was granted. */
  requestAccess(): Promise<boolean>;
  /** Workouts that started after `since` (ms), oldest first. */
  readWorkouts(since: number): Promise<HealthWorkout[]>;
  /** Whether the body readings (weight, height, resting heart rate) may be read. */
  hasBodyAccess(): Promise<boolean>;
  /** Shows the system permission screen for the body readings; true when granted. */
  requestBodyAccess(): Promise<boolean>;
  /** The latest weight, height and resting heart rate; empty when none are available or allowed. */
  readBody(): Promise<HealthBody>;
}

/**
 * What the phone reports before a run about things that quietly end a recording. `null` means
 * it cannot be read here. Battery optimisation is deliberately absent: no installed package reads it.
 */
export interface DeviceReadiness {
  /** Whether location may be read with the app closed ("all the time"). */
  backgroundLocationAllowed(): Promise<boolean | null>;
  /** Whether the recording notification is allowed to show. */
  notificationsAllowed(): Promise<boolean | null>;
  freeStorageBytes(): Promise<number | null>;
  /** Opens this app's page in the phone's settings. */
  openAppSettings(): Promise<void>;
}

export type PushPermission = 'granted' | 'denied' | 'undetermined';

/** Remote notifications: the permission, this phone's push token, and what happens when one arrives or is tapped. */
export interface PushNotifications {
  getPermission(): Promise<PushPermission>;
  /** Shows the system prompt where there is one. */
  requestPermission(): Promise<PushPermission>;
  /** Creates the Android channels ('social', 'recording'); safe to repeat. */
  setupChannels(): Promise<void>;
  /** The EAS project the token belongs to; null in a build without one (Sandbox, plain dev). */
  projectId(): string | null;
  /** This phone's Expo push token, or null when it cannot be had. */
  getToken(projectId: string): Promise<string | null>;
  platform(): 'android' | 'ios';
  /** Decides, for each notification that arrives with the app open, whether to show it. */
  setForegroundFilter(shouldShow: (data: unknown) => boolean): void;
  /** A tap on a notification, with its data. */
  onTap(listener: (data: unknown) => void): Subscription;
  /** The notification whose tap opened the app from closed, once. */
  takeLaunchTap(): Promise<unknown | null>;
}

export interface Platform {
  clock: Clock;
  ids: IdGenerator;
  storage: StorageAdapter;
  location: LocationSource;
  background: BackgroundLocation;
  motion: MotionSensors;
  connectivity: Connectivity;
  haptics: Haptics;
  speaker: Speaker;
  screenAwake: ScreenAwake;
  prompter: Prompter;
  geocoder: Geocoder;
  clipboard: Clipboard;
  photos: PhotoLibrary;
  files: Files;
  health: HealthSource;
  readiness: DeviceReadiness;
  push: PushNotifications;
}
