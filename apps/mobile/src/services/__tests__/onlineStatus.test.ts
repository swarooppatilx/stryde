import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeConnectivity } from '@/platform/fakes';
import { createOnlineStatus } from '@/services/onlineStatus';

let connectivity: FakeConnectivity;

/** A scheduler the test fires by hand, so the debounce needs no real waiting. */
class ManualTimers {
  private pending = new Map<number, { fn: () => void; ms: number }>();
  private next = 0;

  schedule = (fn: () => void, ms: number): (() => void) => {
    const id = this.next++;
    this.pending.set(id, { fn, ms });
    return () => void this.pending.delete(id);
  };

  get waiting(): number[] {
    return [...this.pending.values()].map((t) => t.ms);
  }

  fire(): void {
    const due = [...this.pending.values()];
    this.pending.clear();
    for (const t of due) t.fn();
  }
}

let timers: ManualTimers;

beforeEach(() => {
  connectivity = new FakeConnectivity();
  timers = new ManualTimers();
});

describe('offline debounce', () => {
  it('waits 500 ms before saying offline', () => {
    const status = createOnlineStatus({ connectivity, schedule: timers.schedule });
    const listener = vi.fn();
    status.subscribe(listener);

    connectivity.setOnline(false);

    expect(status.getSnapshot()).toBe(true);
    expect(timers.waiting).toEqual([500]);
    timers.fire();
    expect(status.getSnapshot()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('never says offline when the connection returns within the wait', () => {
    const status = createOnlineStatus({ connectivity, schedule: timers.schedule });
    const listener = vi.fn();
    status.subscribe(listener);

    connectivity.setOnline(false);
    connectivity.setOnline(true);
    timers.fire();

    expect(status.getSnapshot()).toBe(true);
    expect(timers.waiting).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('comes back online at once', () => {
    const status = createOnlineStatus({ connectivity, schedule: timers.schedule });
    connectivity.setOnline(false);
    timers.fire();

    connectivity.setOnline(true);

    expect(status.getSnapshot()).toBe(true);
  });

  it('does not restart the wait for repeated offline reports', () => {
    createOnlineStatus({ connectivity, schedule: timers.schedule });

    connectivity.setOnline(false);
    connectivity.setOnline(false);

    expect(timers.waiting).toEqual([500]);
  });
});

describe('online status', () => {
  it('assumes online until the device says otherwise', () => {
    expect(createOnlineStatus({ connectivity }).getSnapshot()).toBe(true);
  });

  it('picks up an offline device from the first read', async () => {
    connectivity.online = false;
    const status = createOnlineStatus({ connectivity, schedule: timers.schedule });

    await vi.waitFor(() => expect(timers.waiting).toEqual([500]));
    timers.fire();
    expect(status.getSnapshot()).toBe(false);
  });

  it('follows the device going offline and back, telling subscribers each time', () => {
    const status = createOnlineStatus({ connectivity, schedule: timers.schedule });
    const listener = vi.fn();
    status.subscribe(listener);

    connectivity.setOnline(false);
    timers.fire();
    expect(status.getSnapshot()).toBe(false);
    connectivity.setOnline(true);

    expect(status.getSnapshot()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not notify when nothing changed', () => {
    const status = createOnlineStatus({ connectivity });
    const listener = vi.fn();
    status.subscribe(listener);

    connectivity.setOnline(true);

    expect(listener).not.toHaveBeenCalled();
  });

  it('lets a live event beat a slower first read', async () => {
    connectivity.online = true;
    const status = createOnlineStatus({ connectivity, schedule: timers.schedule });
    connectivity.setOnline(false);

    await new Promise((resolve) => setTimeout(resolve, 5));
    timers.fire();

    expect(status.getSnapshot()).toBe(false);
  });

  it('counts a failed first read as online instead of leaving a rejection unhandled', async () => {
    connectivity.isOnline = () => Promise.reject(new Error('no native module'));
    const status = createOnlineStatus({ connectivity, schedule: timers.schedule });

    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(status.getSnapshot()).toBe(true);
    expect(timers.waiting).toEqual([]);
  });
});
