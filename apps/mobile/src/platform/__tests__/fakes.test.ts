import { describe, expect, it } from 'vitest';
import {
  at,
  createFakePlatform,
  FAKE_EPOCH_MS,
  FakeBackgroundLocation,
  FakeClock,
  FakeConnectivity,
  FakeLocationSource,
  loopTrack,
  PUNE,
  ScriptedPrompter,
  straightTrack,
  withJump,
} from '@/platform/fakes';
import type { Location } from '@/types';
import { haversineDistance } from '@/utils/geo';

const fix = (n: number): Location => ({
  latitude: PUNE.latitude + n * 1e-4,
  longitude: PUNE.longitude,
  timestamp: FAKE_EPOCH_MS + n * 1000,
  accuracy: 5,
});

function pathLength(fixes: Location[]): number {
  let total = 0;
  for (let i = 1; i < fixes.length; i++) {
    const from = at(fixes, i - 1);
    const to = at(fixes, i);
    total += haversineDistance(from.latitude, from.longitude, to.latitude, to.longitude);
  }
  return total;
}

describe('FakeClock', () => {
  it('only moves when told to', () => {
    const clock = new FakeClock(5000);
    expect(clock.now()).toBe(5000);
    clock.advance(250);
    expect(clock.now()).toBe(5250);
    clock.set(1);
    expect(clock.now()).toBe(1);
  });
});

describe('FakeLocationSource', () => {
  it('walks the permission states a real device goes through', async () => {
    const location = new FakeLocationSource();
    location.permission = { granted: false, canAskAgain: true };
    location.onRequest = { granted: false, canAskAgain: false };

    expect((await location.getPermission()).granted).toBe(false);
    const afterDeny = await location.requestPermission();
    expect(afterDeny).toEqual({ granted: false, canAskAgain: false });
    expect(await location.getPermission()).toEqual({ granted: false, canAskAgain: false });
    expect(location.requestCount).toBe(1);
  });

  it('delivers fixes to watchers until they unsubscribe', async () => {
    const location = new FakeLocationSource();
    const seen: Location[] = [];
    const sub = await location.watch(
      { accuracy: 'best', timeIntervalMs: 1000, distanceIntervalM: 1 },
      (f) => seen.push(f)
    );
    expect(location.activeWatchers).toBe(1);
    expect(location.watchOptions?.accuracy).toBe('best');

    location.emit(fix(1));
    sub.remove();
    location.emit(fix(2));

    expect(seen).toEqual([fix(1)]);
    expect(location.activeWatchers).toBe(0);
  });

  it('plays a track in order, letting the test move the clock first', async () => {
    const location = new FakeLocationSource();
    const clock = new FakeClock();
    const stamps: number[] = [];
    await location.watch({ accuracy: 'best', timeIntervalMs: 1, distanceIntervalM: 1 }, () =>
      stamps.push(clock.now())
    );

    location.play([fix(1), fix(2), fix(3)], (f) => clock.set(f.timestamp));

    expect(stamps).toEqual([fix(1).timestamp, fix(2).timestamp, fix(3).timestamp]);
  });

  it('refuses getCurrent until a fix is set', async () => {
    const location = new FakeLocationSource();
    await expect(location.getCurrent('balanced')).rejects.toThrow(/no current fix/);
    location.current = fix(1);
    expect(await location.getCurrent('balanced')).toEqual(fix(1));
  });
});

describe('FakeBackgroundLocation', () => {
  it('buffers only while started, and peek does not drain', async () => {
    const bg = new FakeBackgroundLocation();
    bg.deliver(fix(1));
    expect(await bg.peek()).toEqual([]);

    expect(await bg.start('best', 'Run')).toBe(true);
    bg.deliver(fix(2));
    bg.deliver(fix(3));
    expect(await bg.peek()).toEqual([fix(2), fix(3)]);
    expect(await bg.peek()).toHaveLength(2);

    await bg.stop();
    bg.deliver(fix(4));
    expect(await bg.peek()).toHaveLength(2);

    await bg.clear();
    expect(await bg.peek()).toEqual([]);
  });

  it('can refuse to start, like a denied background permission', async () => {
    const bg = new FakeBackgroundLocation();
    bg.startResult = false;
    expect(await bg.start('best', 'Run')).toBe(false);
    bg.deliver(fix(1));
    expect(await bg.peek()).toEqual([]);
  });
});

describe('track generators', () => {
  it('straightTrack covers speed x duration at the requested cadence', () => {
    const track = straightTrack({ speedMps: 3, durationS: 100, intervalS: 2, bearingDeg: 90 });
    expect(track).toHaveLength(51);
    expect(at(track, 1).timestamp - at(track, 0).timestamp).toBe(2000);
    expect(pathLength(track)).toBeGreaterThan(299);
    expect(pathLength(track)).toBeLessThan(301);
    // heading east: latitude holds, longitude grows
    expect(at(track, 50).latitude).toBeCloseTo(at(track, 0).latitude, 6);
    expect(at(track, 50).longitude).toBeGreaterThan(at(track, 0).longitude);
  });

  it('loopTrack ends where it began and walks the full circumference', () => {
    const radius = 60;
    const track = loopTrack({ radiusM: radius, speedMps: 3, intervalS: 2 });
    const first = at(track, 0);
    const last = at(track, -1);
    expect(
      haversineDistance(first.latitude, first.longitude, last.latitude, last.longitude)
    ).toBeLessThan(0.5);
    const circumference = 2 * Math.PI * radius;
    expect(pathLength(track)).toBeGreaterThan(circumference * 0.97);
    expect(pathLength(track)).toBeLessThan(circumference * 1.01);
  });

  it('withJump displaces exactly one fix', () => {
    const track = straightTrack({ speedMps: 2, durationS: 20 });
    const glitched = withJump(track, 4, 200);
    const moved = glitched.filter(
      (f, i) => f.latitude !== track[i]?.latitude || f.longitude !== track[i]?.longitude
    );
    expect(moved).toHaveLength(1);
    expect(
      haversineDistance(
        at(track, 4).latitude,
        at(track, 4).longitude,
        at(glitched, 4).latitude,
        at(glitched, 4).longitude
      )
    ).toBeGreaterThan(190);
    expect(glitched[4]?.timestamp).toBe(track[4]?.timestamp);
  });
});

describe('FakeConnectivity and ScriptedPrompter', () => {
  it('tells subscribers when the network flips', async () => {
    const net = new FakeConnectivity();
    const seen: boolean[] = [];
    const sub = net.subscribe((o) => seen.push(o));
    net.setOnline(false);
    net.setOnline(true);
    sub.remove();
    net.setOnline(false);
    expect(seen).toEqual([false, true]);
    expect(await net.isOnline()).toBe(false);
  });

  it('answers prompts from a queue, then defaults to no', async () => {
    const prompter = new ScriptedPrompter();
    prompter.answers = [true];
    const ask = () => prompter.confirm({ title: 'T', message: 'M', confirmText: 'Yes' });
    expect(await ask()).toBe(true);
    expect(await ask()).toBe(false);
    expect(prompter.prompts).toHaveLength(2);
  });
});

describe('createFakePlatform', () => {
  it('gives every test its own independent fakes', () => {
    const a = createFakePlatform();
    const b = createFakePlatform();
    a.clock.advance(1000);
    expect(b.clock.now()).toBe(FAKE_EPOCH_MS);
    expect(a.ids.next()).toBe('id-1');
    expect(b.ids.next()).toBe('id-1');
  });
});
