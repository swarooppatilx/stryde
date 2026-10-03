import type {
  Clipboard,
  Clock,
  ConfirmOptions,
  Connectivity,
  DeviceReadiness,
  Files,
  Haptics,
  HealthBody,
  HealthSource,
  HealthStatus,
  HealthWorkout,
  IdGenerator,
  MotionSensors,
  PhotoLibrary,
  Prompter,
  PushNotifications,
  PushPermission,
  ScreenAwake,
  Speaker,
  StorageAdapter,
  Subscription,
} from '@/platform/ports';

/** Starts at a fixed instant so every test sees the same dates. */
export const FAKE_EPOCH_MS = Date.UTC(2026, 0, 1, 12, 0, 0);

export class FakeClock implements Clock {
  constructor(private time = FAKE_EPOCH_MS) {}

  now(): number {
    return this.time;
  }

  advance(ms: number): void {
    this.time += ms;
  }

  set(ms: number): void {
    this.time = ms;
  }
}

export class SequentialIds implements IdGenerator {
  private n = 0;

  next(): string {
    this.n += 1;
    return `id-${this.n}`;
  }
}

export class MemoryStorage implements StorageAdapter {
  private data = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.data.delete(key);
  }

  keys(): string[] {
    return [...this.data.keys()];
  }

  /** Raw stored value, for asserting what was persisted. */
  peek(key: string): string | undefined {
    return this.data.get(key);
  }
}

export class FakeMotionSensors implements MotionSensors {
  private accelerationListeners = new Set<(magnitudeG: number) => void>();
  steps = 0;
  heading = 0;
  moving = false;
  available = false;
  startCount = 0;
  stopCount = 0;

  async start(): Promise<void> {
    this.startCount++;
  }

  stop(): void {
    this.stopCount++;
  }

  resetSteps(): void {
    this.steps = 0;
  }

  isAvailable(): boolean {
    return this.available;
  }

  subscribeAcceleration(listener: (magnitudeG: number) => void): () => void {
    this.accelerationListeners.add(listener);
    return () => this.accelerationListeners.delete(listener);
  }

  /** Test helper: deliver one acceleration reading to every subscriber. */
  emitAcceleration(magnitudeG: number): void {
    for (const listener of this.accelerationListeners) listener(magnitudeG);
  }

  getStepCount(): number {
    return this.steps;
  }

  getHeading(): number {
    return this.heading;
  }

  isMoving(): boolean {
    return this.moving;
  }
}

export class FakeConnectivity implements Connectivity {
  online = true;
  private listeners = new Set<(online: boolean) => void>();

  async isOnline(): Promise<boolean> {
    return this.online;
  }

  subscribe(onChange: (online: boolean) => void): Subscription {
    this.listeners.add(onChange);
    return { remove: () => this.listeners.delete(onChange) };
  }

  setOnline(online: boolean): void {
    this.online = online;
    for (const listener of [...this.listeners]) listener(online);
  }
}

export class RecordingHaptics implements Haptics {
  calls: string[] = [];

  tap = () => void this.calls.push('tap');
  impactMedium = () => void this.calls.push('impactMedium');
  impactHeavy = () => void this.calls.push('impactHeavy');
  selection = () => void this.calls.push('selection');
  success = () => void this.calls.push('success');
  warning = () => void this.calls.push('warning');
  error = () => void this.calls.push('error');
}

/** Records what would have been said aloud. */
export class RecordingSpeaker implements Speaker {
  spoken: string[] = [];

  speak = (text: string) => void this.spoken.push(text);
  stop = () => void this.spoken.push('<stop>');
}

/** Records whether the screen is being held awake. */
export class FakeScreenAwake implements ScreenAwake {
  awake = false;

  keepAwake = (on: boolean) => {
    this.awake = on;
  };
}

/** Answers confirm() from a queue (defaults to "no") and records what was asked. */
export class ScriptedPrompter implements Prompter {
  answers: boolean[] = [];
  prompts: ConfirmOptions[] = [];

  async confirm(options: ConfirmOptions): Promise<boolean> {
    this.prompts.push(options);
    return this.answers.shift() ?? false;
  }
}

export class MemoryClipboard implements Clipboard {
  text: string | null = null;

  async copyText(text: string) {
    this.text = text;
  }

  async readText() {
    return this.text ?? '';
  }
}

/** Hands back whatever the test queued; `denied` simulates refused library access. */
export class ScriptedPhotoLibrary implements PhotoLibrary {
  next: { status: 'denied' } | { status: 'picked'; uris: string[] } = {
    status: 'picked',
    uris: [],
  };

  async pick() {
    return this.next;
  }
}

/** Files held in memory: tests seed `contents` for pick results and read back what was written. */
export class MemoryFiles implements Files {
  contents = new Map<string, string>();

  async size(uri: string) {
    const content = this.contents.get(uri);
    return content === undefined ? null : content.length;
  }

  async readBase64(uri: string) {
    const content = this.contents.get(uri);
    if (content === undefined) throw new Error(`No such file: ${uri}`);
    return content;
  }

  async readText(uri: string) {
    return this.readBase64(uri);
  }

  writeCache(name: string, content: string) {
    const uri = `file:///cache/${name}`;
    this.contents.set(uri, content);
    return uri;
  }
}

/** A health source you can script: set `status`, `access` and `workouts`, then see what was asked for. */
export class FakeHealthSource implements HealthSource {
  currentStatus: HealthStatus = 'available';
  access = false;
  /** Whether the permission screen would be accepted. */
  grantOnRequest = true;
  workouts: HealthWorkout[] = [];
  readsSince: number[] = [];

  async status() {
    return this.currentStatus;
  }

  async hasAccess() {
    return this.access;
  }

  async requestAccess() {
    if (this.grantOnRequest) this.access = true;
    return this.access;
  }

  async readWorkouts(since: number) {
    this.readsSince.push(since);
    return this.workouts
      .filter((w) => w.startTime > since)
      .sort((a, b) => a.startTime - b.startTime);
  }

  body: HealthBody = {};
  bodyAccess = false;
  grantBodyOnRequest = true;

  async hasBodyAccess() {
    return this.bodyAccess;
  }

  async requestBodyAccess() {
    if (this.grantBodyOnRequest) this.bodyAccess = true;
    return this.bodyAccess;
  }

  async readBody() {
    return this.bodyAccess ? this.body : {};
  }
}

/** Scripted answers for the pre-run readiness reads. */
export class FakeDeviceReadiness implements DeviceReadiness {
  background: boolean | null = true;
  notifications: boolean | null = true;
  freeBytes: number | null = 10 * 1024 ** 3;
  appSettingsOpened = 0;

  async backgroundLocationAllowed() {
    return this.background;
  }
  async notificationsAllowed() {
    return this.notifications;
  }
  async freeStorageBytes() {
    return this.freeBytes;
  }
  async openAppSettings() {
    this.appSettingsOpened++;
  }
}

/** Scripted push permission and token, recording what the app asked for. */
export class FakePushNotifications implements PushNotifications {
  permission: PushPermission = 'undetermined';
  /** What the system prompt answers when asked. */
  promptAnswer: PushPermission = 'granted';
  project: string | null = 'project-1';
  token: string | null = 'ExponentPushToken[fake]';
  os: 'android' | 'ios' = 'android';
  prompts = 0;
  channelSetups = 0;
  filter: (data: unknown) => boolean = () => true;
  launchTap: unknown | null = null;
  private listeners = new Set<(data: unknown) => void>();

  async getPermission() {
    return this.permission;
  }
  async requestPermission() {
    this.prompts++;
    if (this.permission === 'undetermined') this.permission = this.promptAnswer;
    return this.permission;
  }
  async setupChannels() {
    this.channelSetups++;
  }
  projectId() {
    return this.project;
  }
  async getToken() {
    return this.token;
  }
  platform() {
    return this.os;
  }
  setForegroundFilter(shouldShow: (data: unknown) => boolean) {
    this.filter = shouldShow;
  }
  onTap(listener: (data: unknown) => void): Subscription {
    this.listeners.add(listener);
    return { remove: () => this.listeners.delete(listener) };
  }
  async takeLaunchTap() {
    const tap = this.launchTap;
    this.launchTap = null;
    return tap;
  }
  /** Test helper: the athlete taps a notification. */
  tap(data: unknown) {
    for (const listener of this.listeners) listener(data);
  }
}
