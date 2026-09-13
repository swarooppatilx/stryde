import { Accelerometer, Gyroscope, Pedometer } from 'expo-sensors';
import type { Subscription } from 'expo-sensors/build/DeviceSensor';
import { Platform } from 'react-native';

const STEP_THRESHOLD = 1.2;
const STEP_COOLDOWN_MS = 300;

interface MotionState {
  heading: number;
  stepCount: number;
  isMoving: boolean;
  lastStepTime: number;
  lastGyroTimestamp: number;
  accumulatedRotation: number;
  gyroAvailable: boolean;
  accelAvailable: boolean;
  /** True when the OS-level step counter (health/feel counters) is in use. */
  pedometerAvailable: boolean;
}

class MotionSensorService {
  private static instance: MotionSensorService;
  private state: MotionState = {
    heading: 0,
    stepCount: 0,
    isMoving: false,
    lastStepTime: 0,
    lastGyroTimestamp: 0,
    accumulatedRotation: 0,
    gyroAvailable: false,
    accelAvailable: false,
    pedometerAvailable: false,
  };
  private gyroSub: Subscription | null = null;
  private accelSub: Subscription | null = null;
  private pedoSub: Subscription | null = null;
  /** Pedometer reports cumulative steps; we diff against this to count only new ones. */
  private lastPedometerSteps = 0;
  private lastAccelMagnitude = 1;
  private onUpdate: (() => void) | null = null;
  private refCount = 0;
  private movementSinceLastPedo = 0;

  private constructor() {}

  static getInstance(): MotionSensorService {
    if (!MotionSensorService.instance) {
      MotionSensorService.instance = new MotionSensorService();
    }
    return MotionSensorService.instance;
  }

  async start(options?: { rate?: 10 | 50; onUpdate?: () => void }): Promise<void> {
    this.refCount++;
    if (this.refCount > 1) {
      this.onUpdate = options?.onUpdate ?? null;
      return;
    }

    this.onUpdate = options?.onUpdate ?? null;
    const intervalMs = 1000 / (options?.rate ?? 10);

    try {
      await Gyroscope.setUpdateInterval(intervalMs);
      this.gyroSub = Gyroscope.addListener((data) => {
        const now = Date.now();
        const dt =
          this.state.lastGyroTimestamp > 0 ? (now - this.state.lastGyroTimestamp) / 1000 : 0;
        this.state.lastGyroTimestamp = now;

        if (dt > 0 && dt < 1) {
          this.state.accumulatedRotation += data.z * dt;
          // Normalize to [0, 2π] for consistent external consumption
          this.state.heading =
            ((this.state.accumulatedRotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        }

        this.state.gyroAvailable = true;
        this.notify();
      });
    } catch {
      this.state.gyroAvailable = false;
    }

    // System pedometer is strictly better than our accelerometer heuristic:
    // it's fused by the OS, immune to single-device mounting quirks, and (on
    // iOS) uses the dedicated motion coprocessor instead of polluting the
    // accelerometer bus. Falls back to the raw accelerometer when the OS
    // step counter is unavailable (e.g. some Android devices/emulators).
    if (Platform.OS !== 'web') {
      try {
        if (await Pedometer.isAvailableAsync()) {
          await Pedometer.requestPermissionsAsync();
          this.state.pedometerAvailable = true;
          this.pedoSub = Pedometer.watchStepCount((result) => {
            const total = result.steps;
            if (this.lastPedometerSteps === 0) {
              this.lastPedometerSteps = total;
            } else if (total > this.lastPedometerSteps) {
              const delta = total - this.lastPedometerSteps;
              this.state.stepCount += delta;
              this.state.lastStepTime = Date.now();
              this.state.isMoving = true;
              this.lastPedometerSteps = total;
            }
            this.movementSinceLastPedo = 0;
            this.notify();
          });
        }
      } catch {
        this.state.pedometerAvailable = false;
      }
    }

    try {
      await Accelerometer.setUpdateInterval(intervalMs);
      this.accelSub = Accelerometer.addListener((data) => {
        const magnitude = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
        const now = Date.now();

        const stepDelta = magnitude > STEP_THRESHOLD && magnitude > this.lastAccelMagnitude ? 1 : 0;
        if (
          !this.state.pedometerAvailable &&
          stepDelta > 0 &&
          now - this.state.lastStepTime > STEP_COOLDOWN_MS
        ) {
          this.state.stepCount++;
          this.state.lastStepTime = now;
          this.state.isMoving = true;
        }

        this.movementSinceLastPedo += magnitude - 1;
        if (this.movementSinceLastPedo > 3.5 && now - this.state.lastStepTime > 4000) {
          this.state.isMoving = true;
          this.movementSinceLastPedo = 0;
        }

        this.lastAccelMagnitude = magnitude;

        if (now - this.state.lastStepTime > 2000) {
          this.state.isMoving = false;
        }

        this.state.accelAvailable = true;
        this.notify();
      });
    } catch {
      this.state.accelAvailable = false;
    }
  }

  stop(): void {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount > 0) return;

    this.gyroSub?.remove();
    this.accelSub?.remove();
    this.pedoSub?.remove();
    this.gyroSub = null;
    this.accelSub = null;
    this.pedoSub = null;
    this.lastPedometerSteps = 0;
    this.state.heading = 0;
    this.state.stepCount = 0;
    this.state.isMoving = false;
    this.state.lastStepTime = 0;
    this.state.lastGyroTimestamp = 0;
    this.state.accumulatedRotation = 0;
    this.state.pedometerAvailable = false;
    this.onUpdate = null;
  }

  resetSteps(): void {
    this.state.stepCount = 0;
    this.lastPedometerSteps = 0;
  }

  isAvailable(): boolean {
    return this.state.gyroAvailable || this.state.accelAvailable || this.state.pedometerAvailable;
  }

  isGyroAvailable(): boolean {
    return this.state.gyroAvailable;
  }

  isPedometerAvailable(): boolean {
    return this.state.pedometerAvailable;
  }

  getHeading(): number {
    return this.state.heading;
  }

  getStepCount(): number {
    return this.state.stepCount;
  }

  isMoving(): boolean {
    return this.state.isMoving;
  }

  getState(): Readonly<MotionState> {
    return { ...this.state };
  }

  private notify(): void {
    this.onUpdate?.();
  }
}

export const motionSensorService = MotionSensorService.getInstance();
