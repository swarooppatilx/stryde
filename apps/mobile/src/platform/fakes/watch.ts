import type {
  Subscription,
  WatchLink,
  WatchSample,
  WatchSport,
  WatchState,
  WatchStatus,
} from '@/platform/ports';

/** A watch that tests drive by hand: `emit` a reading, `press` a button on the watch. */
export class FakeWatchLink implements WatchLink {
  currentStatus: WatchStatus = 'unsupported';
  /** What `requestAccess` turns the status into. */
  statusAfterRequest: WatchStatus = 'ready';
  /** Whether `start` reaches the watch. */
  reachable = true;
  /** Every call the phone made, in order: 'start:run', 'pause', 'resume', 'end'. */
  calls: string[] = [];
  private samples = new Set<(sample: WatchSample) => void>();
  private states = new Set<(state: WatchState) => void>();

  async status() {
    return this.currentStatus;
  }

  async requestAccess() {
    this.currentStatus = this.statusAfterRequest;
    return this.currentStatus;
  }

  async start(sport: WatchSport) {
    this.calls.push(`start:${sport}`);
    return this.reachable;
  }

  async pause() {
    this.calls.push('pause');
  }

  async resume() {
    this.calls.push('resume');
  }

  async end() {
    this.calls.push('end');
  }

  onSample(listener: (sample: WatchSample) => void): Subscription {
    this.samples.add(listener);
    return { remove: () => this.samples.delete(listener) };
  }

  onState(listener: (state: WatchState) => void): Subscription {
    this.states.add(listener);
    return { remove: () => this.states.delete(listener) };
  }

  /** A reading arriving from the watch. */
  emit(sample: WatchSample): void {
    for (const listener of this.samples) listener(sample);
  }

  /** A change made on the watch (or the link dropping). */
  press(state: WatchState): void {
    for (const listener of this.states) listener(state);
  }
}

/** For phones and builds with no watch support: always "unsupported", never starts. */
export const noWatch: WatchLink = {
  status: async () => 'unsupported',
  requestAccess: async () => 'unsupported',
  start: async () => false,
  pause: async () => undefined,
  resume: async () => undefined,
  end: async () => undefined,
  onSample: () => ({ remove: () => undefined }),
  onState: () => ({ remove: () => undefined }),
};
