import { MAX_SPEED_KMH } from '@/constants/activity';
import {
  type BackgroundLocation,
  type Clock,
  type Haptics,
  type LocationSource,
  lazyService,
  type MotionSensors,
  type ScreenAwake,
  type Speaker,
  type Subscription,
} from '@/platform';
import type { AccuracyMode } from '@/stores/settingsStore';
import type { ActivityStream, ActivityType, BestEffort, Lap, Location, Ring, Split } from '@/types';
import type { FixRejections, ITerritoryService, ITrackingService } from '@/types/services';
import { computeStream } from '@/utils/activityStream';
import {
  type ActionCueKind,
  type AudioCueInterval,
  actionCue,
  dueCue,
  halfCue,
  lapCue,
  splitCue,
} from '@/utils/audioCue';
import { computeBestEfforts } from '@/utils/bestEfforts';
import { type StepSample, withCadence } from '@/utils/cadence';
import { elevationOf } from '@/utils/elevation';
import { isLocationServicesOff } from '@/utils/errors';
import { showsSpeed, type UnitSystem } from '@/utils/format';
import { smoothLocations } from '@/utils/geo';
import { type LapMark, lapsFromMarks, latestLap } from '@/utils/laps';
import { logger } from '@/utils/logger';
import { isTooShort, MIN_GPS_DISTANCE_M } from '@/utils/minimumRun';
import { LIVE_SPEED_STALE_MS, recentMovement } from '@/utils/recentMovement';
import { downsampleRoute, type RoutePoint } from '@/utils/route';
import { computeSplits } from '@/utils/splits';
import { isTrackTraceOn, trackTrace } from '@/utils/trackTrace';
import { ensureForegroundLocation } from './locationPermission';
import { territoryService } from './territoryService';
import { getTimeToIndexed } from './timeToIndexed';
import { trackingService } from './trackingService';

/** Least distance a GPS-measured activity must cover to be worth saving. */

/** A live pace looks back this far: long enough to smooth GPS jitter, short enough to follow a surge. */
const RECENT_WINDOW_MS = 15_000;

/** Motion sensor samples per second; 10 is enough for steps and pause detection without the drain of 50. */
const SENSOR_RATE_HZ = 10;

export type SessionStatus = 'idle' | 'tracking' | 'paused';

export interface SessionOptions {
  activityType: ActivityType;
  activityLabel: string;
  accuracyMode: AccuracyMode;
  timeIntervalMs: number;
  useGyroscope: boolean;
  autoPause: boolean;
  /** Length of one split in meters (1000 or a mile); defaults to a kilometre. */
  splitMeters?: number;
  /** How often distance is said aloud: each split, each half split, or never (when absent). */
  audioCueInterval?: AudioCueInterval;
  /** Hold the screen awake while recording; on when absent. */
  keepScreenOn?: boolean;
  /** Say aloud when the run starts, pauses, resumes and stops, and how each lap went. */
  announceActions?: boolean;
  /** Units the announcement is spoken in; metric when absent. */
  unitSystem?: UnitSystem;
}

/** Everything the tracking screen shows; a new object whenever any of it changes. */
export interface SessionSnapshot {
  status: SessionStatus;
  /** The sport being recorded; null when idle. After a restart it is the one the run was started with. */
  activityType: ActivityType | null;
  /** Paused because you stopped moving (resumes by itself), not because you tapped pause. */
  autoPaused: boolean;
  distance: number;
  duration: number;
  lastFix: Location | null;
  route: RoutePoint[];
  polygon: Ring | null;
  startLocation: RoutePoint | null;
  /** Recording stops when the screen locks: the OS refused the background task. */
  backgroundOff: boolean;
  /** How many times the athlete has pressed Lap in this run. */
  lapCount: number;
  /** The lap the last press of Lap closed, so the screen can say how it went; null before the first. */
  lastLap: Lap | null;
  /** Every lap closed by a press of Lap, oldest first (the stretch still running is not listed). */
  laps: Lap[];
  /** Distance and moving time at the last press of Lap (zeros before the first): where the running lap began. */
  lapStart: LapMark;
  /** Movement over the last few seconds, for a live pace; zeros while paused or standing still. */
  recent: { distance: number; durationMs: number };
  /** Whole splits finished so far (the unfinished one is not listed). */
  splits: Split[];
  /** Metres climbed so far; null while the phone gives no usable altitude. */
  elevationGain: number | null;
}

export interface SessionSummary {
  /** True when any fix of the run was simulated (Android mock location): it earns no rewards or territory. */
  mocked?: boolean;
  /** When the first fix arrived, in ms since 1970; the activity is dated and named by this, not by the save. */
  startedAt?: number;
  polyline: string;
  distance: number;
  duration: number;
  territory: Ring | null;
  territoryArea: number;
  splits: Split[];
  stream?: ActivityStream;
  /** Metres climbed and descended, from the phone's own altitude; absent when it gave none worth using. */
  elevationGain?: number;
  elevationLoss?: number;
  /** The stretches between presses of Lap (the last one runs to the finish); empty if it was never pressed. */
  laps: Lap[];
  /** Fastest 1 km / 5 km / 10 km; only for pace sports (a ride is judged on speed). */
  bestEfforts: BestEffort[];
}

export type StartResult =
  | { ok: true }
  | { ok: false; reason: 'permission' | 'gps' | 'busy'; message?: string };

export type FinishResult = { ok: true; summary: SessionSummary } | { ok: false; error: string };

export interface TrackingSession {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  /** Picks up a run the app was killed in the middle of. */
  restore(options: SessionOptions): Promise<void>;
  start(options: SessionOptions): Promise<StartResult>;
  pause(): Promise<void>;
  resume(): Promise<StartResult>;
  /** Marks the end of a lap at the current distance and moving time; ignored unless recording. */
  lap(): void;
  finish(): Promise<FinishResult>;
  /** Folds in fixes the background task buffered while the app was away. */
  syncBackground(): Promise<void>;
  /** Call about once a second: refreshes time, auto-pause state and the step-estimated route. */
  tick(): void;
  configure(patch: Partial<Pick<SessionOptions, 'autoPause' | 'useGyroscope'>>): void;
}

export interface TrackingSessionDeps {
  tracking: ITrackingService;
  territory: ITerritoryService;
  location: LocationSource;
  background: BackgroundLocation;
  motion: MotionSensors;
  haptics: Haptics;
  speaker: Speaker;
  screenAwake: ScreenAwake;
  ensureLocationPermission: () => Promise<boolean>;
  /** Tells the live pace whether the GPS chip's last speed is still fresh. */
  clock: Clock;
  /** Told once at the finish how many fixes the recording ignored, by reason. */
  recordRejections?: (counts: FixRejections) => void;
  /**
   * Read the background recorder's fixes while recording, not only after it: phones often give the foreground watcher
   * a fix every 3 s while the background service gets one a second.
   */
  liveBackground?: boolean;
}

/** Fixes wait this long (ms) so both sources' fixes can be put in time order before the track sees them. */
const REORDER_MS = 2500;
/** Two fixes this close in time (ms) are the same reading delivered twice. */
const SAME_FIX_MS = 300;

const IDLE_SNAPSHOT: SessionSnapshot = {
  status: 'idle',
  activityType: null,
  autoPaused: false,
  distance: 0,
  duration: 0,
  lastFix: null,
  route: [],
  polygon: null,
  startLocation: null,
  backgroundOff: false,
  lapCount: 0,
  lastLap: null,
  laps: [],
  lapStart: { distance: 0, duration: 0 },
  recent: { distance: 0, durationMs: 0 },
  splits: [],
  elevationGain: null,
};

const GPS_OFF_MESSAGE = 'Turn on device location (GPS) to track this activity.';
const GPS_FAILED_MESSAGE = 'Unable to access your location.';
const GPS_TIMEOUT_MESSAGE = "Couldn't get a GPS signal. Make sure location is on, then try again.";
/** How long Start waits for the GPS to answer before telling the athlete. */
const WATCH_START_TIMEOUT_MS = 15_000;

class GpsTimeoutError extends Error {}

function gpsFailureMessage(err: unknown): string {
  if (isLocationServicesOff(err)) return GPS_OFF_MESSAGE;
  if (err instanceof GpsTimeoutError) return GPS_TIMEOUT_MESSAGE;
  return GPS_FAILED_MESSAGE;
}

/** Climb and descent for the summary, or nothing when the recording has no usable altitude. */
function climbOf(locations: readonly Location[]): {
  elevationGain?: number;
  elevationLoss?: number;
} {
  const climb = elevationOf(locations);
  return climb ? { elevationGain: climb.gain, elevationLoss: climb.loss } : {};
}

/**
 * One recording from "start" to "finish", with the device behind ports so it runs headless.
 * The screen only renders `getSnapshot()` and calls the methods; GPS, background buffer, permission and sensors are injected.
 */
export function createTrackingSession(deps: TrackingSessionDeps): TrackingSession {
  const { tracking, territory, background, haptics, speaker, screenAwake } = deps;
  const listeners = new Set<() => void>();

  let options: SessionOptions | null = null;
  let watcher: Subscription | null = null;
  let motionRunning = false;
  let stopAcceleration: (() => void) | null = null;
  let starting = false;

  let status: SessionStatus = 'idle';
  let autoPaused = false;
  let distance = 0;
  let duration = 0;
  let lastFix: Location | null = null;
  let route: RoutePoint[] = [];
  let polygon: Ring | null = null;
  let startLocation: RoutePoint | null = null;
  let backgroundOff = false;
  let lapMarks: LapMark[] = [];
  let keptAwake = false;
  /** Cumulative pedometer reads on each tick, feeding the cadence series at save. */
  let stepSamples: StepSample[] = [];
  /** How many tracker locations are already in `route` (route itself gets thinned). */
  let knownCount = 0;
  /** Fixes waiting to enter the track in time order, with the pedometer total when each was taken. */
  let pending: { fix: Location; steps?: number }[] = [];
  /** Newest fix handed to the tracker from the queue. */
  let released = 0;
  let pulling = false;

  let snapshot = IDLE_SNAPSHOT;
  let liveSplits: { finished: number; list: Split[] } = { finished: 0, list: [] };
  /** How far distance has already been said aloud, in half splits, so each point is announced once. */
  let spokenHalves = 0;

  /** The climb so far, recomputed only when another fix has been recorded. */
  let liveClimb: { fixes: number; gain: number | null } = { fixes: 0, gain: null };
  function climbSoFar(): number | null {
    const locations = tracking.getLocations();
    if (locations.length !== liveClimb.fixes) {
      liveClimb = { fixes: locations.length, gain: elevationOf(locations)?.gain ?? null };
    }
    return liveClimb.gain;
  }

  /** Recomputed only when another split completes, not on every emit. */
  function finishedSplits(): Split[] {
    const size = options?.splitMeters ?? 1000;
    const finished = Math.floor(distance / size);
    if (finished !== liveSplits.finished) {
      const whole = computeSplits(tracking.getLocations(), size).filter((s) => s.distance >= size);
      liveSplits = { finished, list: whole };
    }
    return liveSplits.list;
  }

  /** Rebuilt only when Lap is pressed, so the list keeps its identity between fixes. */
  let closedLaps: { marks: LapMark[]; list: Lap[] } = { marks: [], list: [] };
  function lapsClosed(): Lap[] {
    if (closedLaps.marks !== lapMarks) {
      const newest = lapMarks.at(-1);
      closedLaps = { marks: lapMarks, list: newest ? lapsFromMarks(lapMarks, newest) : [] };
    }
    return closedLaps.list;
  }

  function emit(): void {
    snapshot = {
      status,
      activityType: status === 'idle' ? null : (options?.activityType ?? null),
      autoPaused,
      distance,
      duration,
      lastFix,
      route,
      polygon,
      startLocation,
      backgroundOff,
      lapCount: lapMarks.length,
      lastLap: latestLap(lapMarks),
      laps: lapsClosed(),
      lapStart: lapMarks.at(-1) ?? IDLE_SNAPSHOT.lapStart,
      recent:
        status === 'tracking'
          ? recentMovement(
              tracking.getLocations(),
              RECENT_WINDOW_MS,
              deps.clock.now(),
              Math.max(LIVE_SPEED_STALE_MS, 2 * (options?.timeIntervalMs ?? 0))
            )
          : IDLE_SNAPSHOT.recent,
      splits: status === 'idle' ? IDLE_SNAPSHOT.splits : finishedSplits(),
      elevationGain: status === 'idle' ? null : climbSoFar(),
    };
    // A paused run stays awake too: it is about to be resumed or reviewed. Only a change is passed on,
    // not every position update.
    const wantAwake = status !== 'idle' && options?.keepScreenOn !== false;
    if (wantAwake !== keptAwake) {
      keptAwake = wantAwake;
      screenAwake.keepAwake(wantAwake);
    }
    announceDistance(snapshot.splits);
    for (const listener of [...listeners]) listener();
  }

  function announceDistance(finished: readonly Split[]): void {
    if (status === 'idle' || !options) return;
    const unitMeters = options.splitMeters ?? 1000;
    // If several points landed at once (a long gap), only the latest is worth saying.
    const cue = dueCue(spokenHalves, distance, unitMeters, options.audioCueInterval ?? 'off');
    if (!cue) return;
    spokenHalves = cue.halves;
    // A point reached while paused is passed over, not said late on resume.
    if (status !== 'tracking') return;
    const unitSystem = options.unitSystem ?? 'metric';
    const line = cue.whole
      ? wholeSplitLine(finished.slice(0, cue.halves / 2), cue.halves / 2, unitSystem)
      : halfSplitLine(cue.halves, unitMeters / 2, unitSystem);
    if (line) speaker.speak(line);
  }

  function wholeSplitLine(
    upToMark: readonly Split[],
    count: number,
    unitSystem: UnitSystem
  ): string | null {
    const latest = upToMark.at(-1);
    // The split list is measured from the fixes and can trail the live distance by a moment;
    // an earlier split would only repeat a line already said.
    if (!latest || latest.index !== count || !options) return null;
    const totalMs = upToMark.reduce((sum, split) => sum + split.movingTime, 0);
    return splitCue(latest, options.activityType, unitSystem, totalMs);
  }

  function halfSplitLine(halves: number, halfMeters: number, unitSystem: UnitSystem): string {
    // Moving time to the mark, measured the way a whole split's is, so the two kinds of cue agree.
    const pieces = computeSplits(tracking.getLocations(), halfMeters).filter(
      (s) => s.distance >= halfMeters
    );
    const totalMs =
      pieces.length >= halves
        ? pieces.slice(0, halves).reduce((sum, piece) => sum + piece.movingTime, 0)
        : undefined;
    return halfCue(halves, unitSystem, totalMs);
  }

  function announceAction(kind: ActionCueKind): void {
    if (!options?.announceActions) return;
    speaker.speak(actionCue(kind, options.activityType));
  }

  function resetView(): void {
    status = 'idle';
    autoPaused = false;
    distance = 0;
    duration = 0;
    lastFix = null;
    route = [];
    polygon = null;
    startLocation = null;
    backgroundOff = false;
    lapMarks = [];
    knownCount = 0;
    stepSamples = [];
    liveSplits = { finished: 0, list: [] };
    spokenHalves = 0;
    pending = [];
    released = 0;
  }

  const merging = () => deps.liveBackground === true && !backgroundOff;

  /** The pedometer total at a past moment, from the per-tick samples; undefined before the first. */
  function stepsAt(timestamp: number): number | undefined {
    for (let i = stepSamples.length - 1; i >= 0; i--) {
      const sample = stepSamples[i] as StepSample;
      if (sample.t <= timestamp) return sample.steps;
    }
    return undefined;
  }

  function enqueue(fix: Location, steps?: number): void {
    if (fix.timestamp <= released) return;
    const twin = pending.findIndex((p) => Math.abs(p.fix.timestamp - fix.timestamp) < SAME_FIX_MS);
    if (twin >= 0) {
      const kept = pending[twin] as { fix: Location; steps?: number };
      if (fix.accuracy < kept.fix.accuracy) pending[twin] = { fix, steps: kept.steps ?? steps };
      return;
    }
    pending.push({ fix, steps });
  }

  /** Hands the tracker every queued fix taken at or before `cutoff`, oldest first. */
  function release(cutoff: number): boolean {
    if (pending.length === 0) return false;
    pending.sort((a, b) => a.fix.timestamp - b.fix.timestamp);
    let count = 0;
    while (
      count < pending.length &&
      (pending[count] as { fix: Location }).fix.timestamp <= cutoff
    ) {
      const { fix, steps } = pending[count] as { fix: Location; steps?: number };
      tracking.addLocation(fix, steps);
      released = fix.timestamp;
      count++;
    }
    pending = pending.slice(count);
    return count > 0;
  }

  /** Moves what the background recorder buffered into the queue. */
  async function pullBackground(): Promise<void> {
    if (pulling || !merging() || status === 'idle') return;
    pulling = true;
    try {
      const buffered = await background.peek();
      if (buffered.length === 0) return;
      await background.clear();
      for (const fix of buffered) enqueue(fix, stepsAt(fix.timestamp));
    } catch (error) {
      logger.warn('[TrackingSession] Reading background fixes failed', error);
    } finally {
      pulling = false;
    }
  }

  /**
   * Fixes only extend the track every few meters, so the distance alone climbs in 3-5 m jumps. The steps taken since
   * the last point fill the gap until the next fix measures it; the figure never steps back while recording.
   */
  function measure(): void {
    const tracked = options?.useGyroscope
      ? tracking.getInterpolatedDistance()
      : tracking.getDistance();
    const stepping =
      status === 'tracking' && options !== null && MOTION_PAUSE_SPORTS.has(options.activityType);
    const live = stepping ? tracked + tracking.getInterpolatedStepDistance() : tracked;
    distance = status === 'idle' ? live : Math.max(distance, live);
    duration = tracking.getDuration();
  }

  /** Adds locations the tracker accepted since the last check to the route, polygon and start marker. */
  function absorbNewLocations(): boolean {
    const kept = tracking.getLocations();
    const first = kept[0];
    // The tracker swaps a single starting fix for a sharper one; redraw the start from it.
    if (kept.length === 1 && knownCount === 1 && first) {
      const start: RoutePoint = [first.longitude, first.latitude];
      const drawn = route[0];
      if (drawn && (drawn[0] !== start[0] || drawn[1] !== start[1])) {
        route = [start];
        startLocation = start;
        return true;
      }
    }
    if (kept.length <= knownCount) {
      knownCount = kept.length;
      return false;
    }
    const added = kept.slice(knownCount).map((p): RoutePoint => [p.longitude, p.latitude]);
    route = downsampleRoute([...route, ...added]);
    knownCount = kept.length;
    if (first) startLocation ??= [first.longitude, first.latitude];
    polygon = territory.getEnclosedPolygon(kept);
    return true;
  }

  /** The tracker auto-pauses and auto-resumes by itself; mirror that into the session status. */
  function syncStatusFromTracker(): void {
    if (status === 'tracking' && tracking.getIsAutoPaused()) {
      status = 'paused';
      autoPaused = true;
    } else if (status === 'paused' && autoPaused && tracking.getIsTracking()) {
      status = 'tracking';
      autoPaused = false;
    }
  }

  /** Sports whose pause can come from the accelerometer: the phone moves with the athlete. */
  const MOTION_PAUSE_SPORTS: ReadonlySet<string> = new Set(['run', 'walk', 'hike']);

  /**
   * Motion sensors run while recording with the assist on, and while a run, walk or hike has auto-pause on
   * (also when paused, so movement can lift a pause). Always balanced start/stop.
   */
  function applyMotion(): void {
    const assist = status === 'tracking' && options?.useGyroscope === true;
    const detectsPause =
      status !== 'idle' &&
      options?.autoPause === true &&
      MOTION_PAUSE_SPORTS.has(options.activityType);
    tracking.setUseGyroscope(assist);
    const wanted = assist || detectsPause;
    if (wanted && !motionRunning) {
      motionRunning = true;
      void deps.motion.start({ rate: SENSOR_RATE_HZ });
      stopAcceleration = deps.motion.subscribeAcceleration((g) =>
        tracking.addAccelerationSample(g)
      );
    } else if (!wanted && motionRunning) {
      motionRunning = false;
      stopAcceleration?.();
      stopAcceleration = null;
      deps.motion.stop();
    }
  }

  async function startWatching(): Promise<void> {
    if (watcher || !options) return;
    const pending = deps.location.watch(
      {
        accuracy: options.accuracyMode,
        timeIntervalMs: options.timeIntervalMs,
        distanceIntervalM: 1,
      },
      onFix
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new GpsTimeoutError()), WATCH_START_TIMEOUT_MS);
    });
    try {
      watcher = await Promise.race([pending, timeout]);
    } catch (error) {
      // A watcher that arrives after it was abandoned must not keep listening unseen.
      if (error instanceof GpsTimeoutError)
        void pending.then(
          (late) => late.remove(),
          () => {}
        );
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function stopWatching(): void {
    watcher?.remove();
    watcher = null;
  }

  function startBackground(): void {
    if (!options) return;
    // Not awaited: the OS may sit on a permission prompt, and recording must not wait for it.
    background
      .start(options.accuracyMode, options.activityLabel)
      .catch((error) => {
        logger.warn('[TrackingSession] Background tracking failed to start', error);
        return false;
      })
      .then((running) => {
        if (status === 'idle' || backgroundOff === !running) return;
        backgroundOff = !running;
        emit();
      })
      .catch((error) => logger.warn('[Tracking] Background tracking update failed', error));
  }

  function onFix(fix: Location): void {
    if (merging()) {
      enqueue(fix, motionRunning ? deps.motion.getStepCount() : undefined);
      release(deps.clock.now() - REORDER_MS);
    } else {
      tracking.addLocation(fix);
    }
    lastFix = fix;
    syncStatusFromTracker();
    absorbNewLocations();
    measure();
    applyMotion();
    emit();
  }

  async function drainBackground(): Promise<void> {
    const buffered = await background.peek();
    if (buffered.length === 0 && pending.length === 0) return;
    if (deps.liveBackground) {
      for (const fix of buffered) enqueue(fix, stepsAt(fix.timestamp));
      release(Number.POSITIVE_INFINITY);
    } else {
      for (const point of [...buffered].sort((a, b) => a.timestamp - b.timestamp)) {
        tracking.addLocation(point);
      }
    }
    if (buffered.length > 0) await background.clear();
    syncStatusFromTracker();
    absorbNewLocations();
  }

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async restore(restoreOptions) {
      // The tab can remount while a run is live; storage is up to 5 s behind memory.
      if (status !== 'idle' || starting) return;
      await tracking.restoreSession();
      if (tracking.getStartTime() === null) return;

      const stored = tracking.getActivityType() as ActivityType | null;
      const activityType = stored && stored in MAX_SPEED_KMH ? stored : restoreOptions.activityType;
      options = { ...restoreOptions, activityType };
      tracking.setMaxSpeed(MAX_SPEED_KMH[activityType]);
      tracking.setAutoPauseEnabled(restoreOptions.autoPause);

      const running = tracking.getIsTracking();
      status = running ? 'tracking' : 'paused';
      autoPaused = tracking.getIsAutoPaused();
      knownCount = 0;
      route = [];
      startLocation = null;
      stepSamples = [];
      absorbNewLocations();
      lastFix = tracking.getLocations().at(-1) ?? null;

      if (running) await drainBackground();

      // An auto-paused run still needs GPS to notice you moving again.
      if (running || autoPaused) {
        const listening =
          (await deps.ensureLocationPermission()) &&
          (await startWatching().then(
            () => true,
            () => false
          ));
        if (!listening && running) {
          await tracking.pauseTracking();
          status = 'paused';
        }
      }
      if (status === 'tracking') startBackground();

      measure();
      applyMotion();
      emit();
    },

    async start(startOptions) {
      if (status !== 'idle' || starting) return { ok: false, reason: 'busy' };
      starting = true;
      try {
        if (!(await deps.ensureLocationPermission())) return { ok: false, reason: 'permission' };

        options = startOptions;
        tracking.setMaxSpeed(MAX_SPEED_KMH[startOptions.activityType]);
        tracking.setAutoPauseEnabled(startOptions.autoPause);
        await tracking.startTracking(startOptions.activityType);
        // Points a previous aborted run left behind would replay into this one.
        await background.clear();
        resetView();

        try {
          status = 'tracking';
          await startWatching();
          announceAction('start');
        } catch (err) {
          await tracking.stopTracking();
          resetView();
          options = null;
          emit();
          return {
            ok: false,
            reason: 'gps',
            message: gpsFailureMessage(err),
          };
        }

        startBackground();
        applyMotion();
        measure();
        emit();
        trackTrace('start', {
          sport: startOptions.activityType,
          mode: startOptions.accuracyMode,
          intervalMs: startOptions.timeIntervalMs,
          assist: startOptions.useGyroscope,
          autoPause: startOptions.autoPause,
        });
        return { ok: true };
      } finally {
        starting = false;
      }
    },

    lap() {
      if (status !== 'tracking') return;
      haptics.impactMedium();
      measure();
      lapMarks = [...lapMarks, { distance, duration }];
      emit();
      const closed = latestLap(lapMarks);
      if (options?.announceActions && closed)
        speaker.speak(lapCue(closed, options.unitSystem ?? 'metric'));
    },

    async pause() {
      haptics.impactMedium();
      release(Number.POSITIVE_INFINITY);
      absorbNewLocations();
      await tracking.pauseTracking();
      stopWatching();
      background
        .stop()
        .catch((error) =>
          logger.warn('[TrackingSession] Background tracking failed to stop', error)
        );
      status = 'paused';
      autoPaused = false;
      applyMotion();
      measure();
      emit();
      announceAction('pause');
    },

    async resume() {
      haptics.impactMedium();
      await tracking.resumeTracking();
      status = 'tracking';
      autoPaused = false;
      try {
        await startWatching();
      } catch (err) {
        await tracking.pauseTracking();
        status = 'paused';
        measure();
        emit();
        return {
          ok: false,
          reason: 'gps',
          message: isLocationServicesOff(err) ? GPS_OFF_MESSAGE : GPS_FAILED_MESSAGE,
        };
      }
      startBackground();
      applyMotion();
      measure();
      emit();
      announceAction('resume');
      return { ok: true };
    },

    async finish() {
      if (status === 'idle') return { ok: false, error: 'No activity in progress.' };

      stopWatching();
      await background.stop();
      await drainBackground();
      deps.recordRejections?.(tracking.getRejections());

      measure();
      const locations = tracking.getLocations();
      const polyline = options?.useGyroscope
        ? tracking.generateInterpolatedPolyline()
        : tracking.generatePolyline();
      // The headline distance is measured along the smoothed track, so the splits and efforts are cut from
      // that same track: on raw fixes GPS jitter made them add up to far more than the distance shown.
      const cleaned = smoothLocations(locations);
      const summaryTerritory = territory.getEnclosedPolygon(locations);
      const summary: SessionSummary = {
        startedAt: locations[0]?.timestamp,
        ...(locations.some((fix) => fix.mocked) && { mocked: true }),
        polyline,
        distance,
        duration,
        territory: summaryTerritory,
        territoryArea: summaryTerritory ? territory.getPolygonArea(summaryTerritory) : 0,
        splits: computeSplits(cleaned, options?.splitMeters ?? 1000),
        stream: withCadence(computeStream(locations), stepSamples),
        ...climbOf(locations),
        laps: lapsFromMarks(lapMarks, { distance, duration }),
        bestEfforts:
          options && !showsSpeed(options.activityType)
            ? computeBestEfforts(cleaned, distance, options.activityType)
            : [],
      };

      const finishedSport = options?.activityType;
      const rejected = tracking.getRejections();
      trackTrace('finish', {
        dist: distance,
        gpsOnly: tracking.getDistance(),
        durationMs: duration,
        fixes: locations.length,
        stepPoints: tracking.getAllLocations().length - locations.length,
        rejAcc: rejected.accuracy,
        rejJitter: rejected.duplicate,
        rejJump: rejected.speed + rejected.acceleration,
      });
      announceAction('finish');
      const result = await tracking.stopTracking();
      resetView();
      applyMotion();
      emit();

      if (!result.success) return { ok: false, error: result.error ?? 'Please try again.' };
      // A GPS sport that never moved is a mis-tap or a lost signal, not an activity.
      if (finishedSport && isTooShort(finishedSport, summary.distance)) {
        return {
          ok: false,
          error: `Activity too short — you moved less than ${MIN_GPS_DISTANCE_M} m.`,
        };
      }
      haptics.success();
      return { ok: true, summary };
    },

    async syncBackground() {
      if (status !== 'tracking') return;
      // Returning to the foreground after granting "all the time" in Settings is the one moment this run
      // can still get a foreground service: Android 11+ refuses background location from the in-app
      // prompt, so the attempt at start() cannot succeed.
      if (backgroundOff) startBackground();
      await drainBackground();
      measure();
      emit();
    },

    tick() {
      if (status === 'idle') return;
      const before = { status, distance, duration };
      if (merging()) {
        if (release(deps.clock.now() - REORDER_MS)) absorbNewLocations();
        void pullBackground().then(() => {
          if (!release(deps.clock.now() - REORDER_MS)) return;
          syncStatusFromTracker();
          absorbNewLocations();
          measure();
          emit();
        });
      }
      if (status === 'tracking') tracking.checkSignalLoss();
      syncStatusFromTracker();
      if (status === 'tracking' && options?.useGyroscope) {
        const stepPoint = tracking.generateInterpolatedPoint();
        if (stepPoint) {
          // The service builds its saved distance and polyline from its own
          // interpolated set. Without this the map drew the step-estimated
          // point but the saved track fell back to GPS-only.
          tracking.addInterpolatedLocation(stepPoint);
          route = downsampleRoute([...route, [stepPoint.longitude, stepPoint.latitude]]);
        }
      }
      applyMotion();
      // Cadence rides the already-running pedometer (auto-pause for stepping
      // sports, or the gyro-assist); sampling it once per tick costs nothing extra.
      if (status === 'tracking' && motionRunning) {
        stepSamples.push({ t: Date.now(), steps: deps.motion.getStepCount() });
      }
      measure();
      if (isTrackTraceOn()) {
        trackTrace('tick', {
          t: duration,
          status,
          dist: distance,
          stepAhead: tracking.getInterpolatedStepDistance(),
          steps: motionRunning ? deps.motion.getStepCount() : null,
          fixes: tracking.getLocations().length,
          sinceFix: lastFix ? deps.clock.now() - lastFix.timestamp : null,
        });
      }
      const changed =
        status !== before.status || distance !== before.distance || duration !== before.duration;
      if (changed || (status === 'tracking' && options?.useGyroscope)) emit();
    },

    configure(patch) {
      if (!options) return;
      options = { ...options, ...patch };
      tracking.setAutoPauseEnabled(options.autoPause);
      applyMotion();
    },
  };
}

/** The app-wide session, built on first use from the installed platform. */
export const trackingSession: TrackingSession = lazyService((platform) =>
  createTrackingSession({
    tracking: trackingService,
    territory: territoryService,
    location: platform.location,
    background: platform.background,
    motion: platform.motion,
    haptics: platform.haptics,
    speaker: platform.speaker,
    screenAwake: platform.screenAwake,
    ensureLocationPermission: ensureForegroundLocation,
    clock: platform.clock,
    liveBackground: true,
    recordRejections: (counts) => getTimeToIndexed().log.record('record.rejections', { counts }),
  })
);
