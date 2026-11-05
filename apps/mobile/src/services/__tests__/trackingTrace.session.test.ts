import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  at,
  type FakePlatform,
  installFakePlatform,
  straightTrack,
  uninstallFakePlatform,
} from '@/platform/fakes';
import { territoryService } from '@/services/territoryService';
import { createTrackingService } from '@/services/trackingService';
import { createTrackingSession, type SessionOptions } from '@/services/trackingSession';
import type { Location } from '@/types';
import { createTrackingTrace, type TraceStore } from '@/utils/trackingTrace';

const OPTS: SessionOptions = {
  activityType: 'run',
  activityLabel: 'Run',
  accuracyMode: 'best',
  timeIntervalMs: 1000,
  useGyroscope: false,
  autoPause: false,
};

let platform: FakePlatform;
let written: string;

function build() {
  const store: TraceStore = {
    append: (_path, content) => {
      written += content;
    },
    list: () => [],
    remove() {},
  };
  const trace = createTrackingTrace({ store, now: () => platform.clock.now(), enabled: true });
  const tracking = createTrackingService({ ...platform, trace });
  const session = createTrackingSession({
    tracking,
    territory: territoryService,
    location: platform.location,
    background: platform.background,
    motion: platform.motion,
    haptics: platform.haptics,
    speaker: platform.speaker,
    screenAwake: platform.screenAwake,
    ensureLocationPermission: async () => true,
    clock: platform.clock,
    trace,
  });
  return { session };
}

const events = () =>
  written
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { kind: string } & Record<string, unknown>);

beforeEach(() => {
  vi.useFakeTimers();
  platform = installFakePlatform();
  written = '';
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  uninstallFakePlatform();
});

describe('tracking trace over a recording', () => {
  it('records every fix with its outcome, the live stats, and a finish summary', async () => {
    const { session } = build();
    await session.start(OPTS);

    const track = straightTrack({ speedMps: 3, durationS: 120 });
    // One fix five kilometres off the line: the tracker must ignore it as a teleport.
    const real = at(track, 30);
    const jump: Location = { ...real, latitude: real.latitude + 0.05 };
    const fixes = track.map((fix) => (fix === real ? jump : fix));
    platform.location.play(fixes, (fix) => {
      platform.clock.set(fix.timestamp);
      session.tick();
    });

    const result = await session.finish();
    expect(result.ok).toBe(true);

    const all = events();
    const kinds = new Set(all.map((e) => e.kind));
    for (const kind of ['trace.begin', 'fix', 'stats', 'session.summary', 'session.finish']) {
      expect(kinds).toContain(kind);
    }

    const fixEvents = all.filter((e) => e.kind === 'fix');
    expect(fixEvents).toHaveLength(fixes.length);
    expect(fixEvents.filter((e) => e.outcome === 'accept')).toHaveLength(track.length - 1);
    expect(fixEvents.find((e) => e.ts === jump.timestamp)?.outcome).toBe('ignore-teleport');

    const summary = all.find((e) => e.kind === 'session.summary') as unknown as {
      saved: { distanceM: number };
      lengths: { incrementalM: number; rawM: number; cleanedM: number };
    };
    expect(result.ok && summary.saved.distanceM).toBeCloseTo(
      result.ok ? result.summary.distance : 0,
      0
    );
    // About 360 m at 3 m/s for two minutes, whichever way it is measured.
    for (const length of Object.values(summary.lengths)) expect(length).toBeGreaterThan(330);

    expect(all.at(-1)?.kind).toBe('session.finish');
    // Sequence numbers are gapless, so a lost chunk would show.
    expect(all.map((e) => e.seq)).toEqual(all.map((_, i) => i));
  });
});
