import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeBleSensors, FakeClock } from '@/platform/fakes';
import { createSensorHub } from '@/services/sensorHub';
import { MAX_RECONNECT_ATTEMPTS, SENSOR_STALE_MS } from '@/utils/sensorLive';

const bytes = (...values: number[]) => Uint8Array.from(values);
const hr = (bpm: number) => ({ kind: 'heartRate' as const, value: bytes(0x00, bpm) });

let ble: FakeBleSensors;
let clock: FakeClock;
let wheelMm: number;

function setup() {
  return createSensorHub({ ble, clock, wheelMm: () => wheelMm });
}

beforeEach(() => {
  vi.useFakeTimers();
  ble = new FakeBleSensors();
  clock = new FakeClock(1_000_000);
  wheelMm = 2000;
});
afterEach(() => vi.useRealTimers());

describe('connecting and reading', () => {
  it('connects, shows heart rate, and drops it once it goes stale', async () => {
    const hub = setup();
    expect(await hub.connect({ id: 'strap', name: 'Strap', kinds: ['heartRate'] })).toBe(true);
    expect(hub.getSnapshot().links[0]?.status).toBe('connected');

    ble.notify('strap', hr(142));
    expect(hub.live(clock.now()).heartRate).toBe(142);

    clock.advance(SENSOR_STALE_MS + 1);
    expect(hub.live(clock.now()).heartRate).toBeUndefined();
  });

  it('ignores a heart rate while the strap reports no skin contact', async () => {
    const hub = setup();
    await hub.connect({ id: 'strap', name: 'Strap', kinds: ['heartRate'] });
    ble.notify('strap', { kind: 'heartRate', value: bytes(0x04, 0) });
    expect(hub.live(clock.now()).heartRate).toBeUndefined();
  });

  it('shows power and a cadence worked out from the crank', async () => {
    const hub = setup();
    await hub.connect({ id: 'pedals', name: 'Pedals', kinds: ['power'] });
    const reading = (power: number, revs: number, time: number) => ({
      kind: 'power' as const,
      value: bytes(0x20, 0x00, power & 0xff, power >> 8, revs, 0, time & 0xff, time >> 8),
    });
    ble.notify('pedals', reading(200, 10, 0));
    clock.advance(1000);
    ble.notify('pedals', reading(210, 11, 1024));
    const live = hub.live(clock.now());
    expect(live.power).toBe(210);
    expect(live.cadence).toBe(60);
  });

  it('works out speed from the wheel with the wheel size setting', async () => {
    const hub = setup();
    await hub.connect({ id: 'csc', name: 'Sensor', kinds: ['speedCadence'] });
    const wheel = (revs: number, time: number) => ({
      kind: 'speedCadence' as const,
      value: bytes(0x01, revs, 0, 0, 0, time & 0xff, time >> 8),
    });
    ble.notify('csc', wheel(10, 0));
    clock.advance(1000);
    ble.notify('csc', wheel(15, 1024));
    expect(hub.live(clock.now()).speed).toBeCloseTo(10, 5);
  });

  it('ignores a value too short to read', async () => {
    const hub = setup();
    await hub.connect({ id: 'strap', name: 'Strap', kinds: ['heartRate'] });
    ble.notify('strap', { kind: 'heartRate', value: bytes() });
    expect(hub.live(clock.now()).heartRate).toBeUndefined();
  });
});

describe('losing a sensor', () => {
  it('without a recording, a dropped sensor is lost and nothing retries', async () => {
    const hub = setup();
    await hub.connect({ id: 'strap', name: 'Strap', kinds: ['heartRate'] });
    ble.drop('strap');
    expect(hub.getSnapshot().links[0]?.status).toBe('lost');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(ble.calls.filter((c) => c === 'connect:strap')).toHaveLength(1);
  });

  it('while recording, reconnects with backoff', async () => {
    const hub = setup();
    hub.beginRecording();
    await hub.connect({ id: 'strap', name: 'Strap', kinds: ['heartRate'] });
    ble.failConnects.set('strap', 1);
    ble.drop('strap');
    expect(hub.getSnapshot().links[0]?.status).toBe('reconnecting');
    expect(hub.live(clock.now()).lost).toEqual(['heartRate']);

    await vi.advanceTimersByTimeAsync(1000);
    expect(hub.getSnapshot().links[0]?.status).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(2000);
    expect(hub.getSnapshot().links[0]?.status).toBe('connected');
    expect(hub.live(clock.now()).lost).toEqual([]);
    ble.notify('strap', hr(150));
    expect(hub.live(clock.now()).heartRate).toBe(150);
  });

  it('gives up after the bounded number of attempts', async () => {
    const hub = setup();
    hub.beginRecording();
    await hub.connect({ id: 'strap', name: 'Strap', kinds: ['heartRate'] });
    ble.failConnects.set('strap', 1000);
    ble.drop('strap');
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(hub.getSnapshot().links[0]?.status).toBe('lost');
    expect(ble.calls.filter((c) => c === 'connect:strap')).toHaveLength(1 + MAX_RECONNECT_ATTEMPTS);
  });

  it('ending the recording stops retrying and disconnects', async () => {
    const hub = setup();
    hub.beginRecording();
    await hub.connect({ id: 'strap', name: 'Strap', kinds: ['heartRate'] });
    await hub.connect({ id: 'gone', name: 'Other', kinds: ['power'] });
    ble.drop('gone');
    await hub.endRecording();
    expect(ble.calls).toContain('disconnect:strap');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(ble.calls.filter((c) => c === 'connect:gone')).toHaveLength(1);
    expect(hub.getSnapshot().links).toEqual([]);
  });

  it('a connection that fails the first time is not announced as lost', async () => {
    const hub = setup();
    hub.beginRecording();
    ble.failConnects.set('strap', 1);
    expect(await hub.connect({ id: 'strap', name: 'Strap', kinds: ['heartRate'] })).toBe(false);
    expect(hub.getSnapshot().links[0]?.status).toBe('reconnecting');
    expect(hub.live(clock.now()).lost).toEqual([]);
  });
});

describe('connecting several and disconnecting', () => {
  it('connectPaired joins the kinds of a device paired for more than one', async () => {
    const hub = setup();
    await hub.connectPaired([
      { id: 'p', name: 'Pedals', kind: 'power', lastSeen: 0 },
      { id: 'p', name: 'Pedals', kind: 'speedCadence', lastSeen: 0 },
      { id: 's', name: 'Strap', kind: 'heartRate', lastSeen: 0 },
    ]);
    expect(ble.calls.filter((c) => c.startsWith('connect:'))).toEqual(['connect:p', 'connect:s']);
    const links = hub.getSnapshot().links;
    expect(links.find((l) => l.id === 'p')?.kinds).toEqual(['power', 'speedCadence']);
  });

  it('disconnect removes the link and its readings stop being shown as connected', async () => {
    const hub = setup();
    await hub.connect({ id: 'strap', name: 'Strap', kinds: ['heartRate'] });
    await hub.disconnect('strap');
    expect(ble.isConnected('strap')).toBe(false);
    expect(hub.live(clock.now()).connected).toEqual([]);
  });

  it('a disconnect that arrives while connecting closes the link when it opens', async () => {
    const hub = setup();
    const pending = hub.connect({ id: 'strap', name: 'Strap', kinds: ['heartRate'] });
    await hub.disconnect('strap');
    expect(await pending).toBe(false);
    expect(ble.isConnected('strap')).toBe(false);
  });

  it('reconnects a connected sensor when it is paired for another kind', async () => {
    const hub = setup();
    await hub.connect({ id: 'p', name: 'Pedals', kinds: ['power'] });
    await hub.connect({ id: 'p', name: 'Pedals', kinds: ['power', 'speedCadence'] });
    expect(ble.calls.filter((c) => c === 'connect:p')).toHaveLength(2);
    expect(hub.getSnapshot().links[0]?.kinds).toEqual(['power', 'speedCadence']);
  });

  it('connecting a sensor that is already connected does nothing more', async () => {
    const hub = setup();
    await hub.connect({ id: 'strap', name: 'Strap', kinds: ['heartRate'] });
    expect(await hub.connect({ id: 'strap', name: 'Strap', kinds: ['heartRate'] })).toBe(true);
    expect(ble.calls.filter((c) => c === 'connect:strap')).toHaveLength(1);
  });
});

describe('recording samples', () => {
  it('keeps one sample a second per kind while recording, none while paused', async () => {
    const hub = setup();
    await hub.connect({ id: 'strap', name: 'Strap', kinds: ['heartRate'] });
    ble.notify('strap', hr(100));
    expect(hub.samples()).toHaveLength(0);

    hub.beginRecording();
    ble.notify('strap', hr(110));
    clock.advance(300);
    ble.notify('strap', hr(111));
    clock.advance(800);
    ble.notify('strap', hr(112));
    hub.setCollecting(false);
    clock.advance(2000);
    ble.notify('strap', hr(113));

    expect(hub.samples().map((s) => s.heartRate)).toEqual([110, 112]);
    expect(hub.samples()[0]?.t).toBe(1_000_000);
  });

  it('keeps the samples after the recording ends until they are cleared', async () => {
    const hub = setup();
    hub.beginRecording();
    await hub.connect({ id: 'strap', name: 'Strap', kinds: ['heartRate'] });
    ble.notify('strap', hr(120));
    await hub.endRecording();
    expect(hub.samples()).toHaveLength(1);
    hub.clearSamples();
    expect(hub.samples()).toHaveLength(0);
  });
});

describe('listeners', () => {
  it('tells listeners about readings and status changes, and stops after unsubscribe', async () => {
    const hub = setup();
    const listener = vi.fn();
    const stop = hub.subscribe(listener);
    await hub.connect({ id: 'strap', name: 'Strap', kinds: ['heartRate'] });
    const afterConnect = listener.mock.calls.length;
    expect(afterConnect).toBeGreaterThan(0);
    ble.notify('strap', hr(120));
    expect(listener.mock.calls.length).toBeGreaterThan(afterConnect);
    stop();
    const total = listener.mock.calls.length;
    ble.notify('strap', hr(121));
    expect(listener).toHaveBeenCalledTimes(total);
  });
});
