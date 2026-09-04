import { Accelerometer, Gyroscope } from 'expo-sensors';
import type { Subscription } from 'expo-sensors/build/DeviceSensor';

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
  };
  private gyroSub: Subscription | null = null;
  private accelSub: Subscription | null = null;
  private lastAccelMagnitude = 1;
  private onUpdate: (() => void) | null = null;

  private constructor() {}

  static getInstance(): MotionSensorService {
    if (!MotionSensorService.instance) {
      MotionSensorService.instance = new MotionSensorService();
    }
    return MotionSensorService.instance;
  }

  async start(options?: { rate?: 10 | 50; onUpdate?: () => void }): Promise<void> {
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
          this.state.heading = this.state.accumulatedRotation;
        }

        this.state.gyroAvailable = true;
        this.notify();
      });
    } catch {
      this.state.gyroAvailable = false;
    }

    try {
      await Accelerometer.setUpdateInterval(intervalMs);
      this.accelSub = Accelerometer.addListener((data) => {
        const magnitude = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
        const now = Date.now();

        if (
          magnitude > STEP_THRESHOLD &&
          magnitude > this.lastAccelMagnitude &&
          now - this.state.lastStepTime > STEP_COOLDOWN_MS
        ) {
          this.state.stepCount++;
          this.state.lastStepTime = now;
          this.state.isMoving = true;
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
    this.gyroSub?.remove();
    this.accelSub?.remove();
    this.gyroSub = null;
    this.accelSub = null;
    this.state.heading = 0;
    this.state.stepCount = 0;
    this.state.isMoving = false;
    this.state.lastStepTime = 0;
    this.state.lastGyroTimestamp = 0;
    this.state.accumulatedRotation = 0;
    this.onUpdate = null;
  }

  resetSteps(): void {
    this.state.stepCount = 0;
  }

  isAvailable(): boolean {
    return this.state.gyroAvailable || this.state.accelAvailable;
  }

  isGyroAvailable(): boolean {
    return this.state.gyroAvailable;
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
