import type { TimedPoint } from '@repo/shared/segments';
import { describe, expect, it } from 'vitest';
import {
  createLiveSegmentTracker,
  deltaVsTarget,
  formatDelta,
  type LiveSegment,
  liveSegmentLine,
} from '@/utils/liveSegments';

const T0 = 1_700_000_000_000;
const STEP_DEG = 0.000324;
const at = (i: number, lng = 72.8777, lat0 = 19.076): TimedPoint => ({
  latitude: lat0 + i * STEP_DEG,
  longitude: lng,
  timestamp: T0 + i * 10_000,
});

const segment = (over: Partial<LiveSegment> = {}): LiveSegment => ({
  key: 'seg',
  name: 'Sea link',
  start: { latitude: 19.076 + 5 * STEP_DEG, longitude: 72.8777 },
  end: { latitude: 19.076 + 35 * STEP_DEG, longitude: 72.8777 },
  distanceM: Math.round(30 * STEP_DEG * 111_195),
  prSec: 330,
  leaderSec: 280,
  ...over,
});

describe('deltaVsTarget / formatDelta', () => {
  it('compares at the same share of the segment', () => {
    expect(deltaVsTarget(100, 400, 1000, 300)).toBe(-20);
    expect(deltaVsTarget(150, 500, 1000, 300)).toBe(0);
    expect(deltaVsTarget(200, 500, 1000, 300)).toBe(50);
  });

  it('clamps coverage past the end', () => {
    expect(deltaVsTarget(310, 2000, 1000, 300)).toBe(10);
  });

  it('formats ahead and behind', () => {
    expect(formatDelta(-12)).toBe('-0:12');
    expect(formatDelta(65)).toBe('+1:05');
    expect(formatDelta(0)).toBe('+0:00');
  });
});

describe('liveSegmentLine', () => {
  const base = {
    key: 'k',
    name: 'Sea link',
    elapsedSec: 100,
    coveredM: 500,
    distanceM: 1000,
  };

  it('prefers the PR, then the leader, then the bare time', () => {
    expect(liveSegmentLine({ ...base, prSec: 300, leaderSec: 200 }).detail).toBe('-0:50 vs PR');
    expect(liveSegmentLine({ ...base, prSec: null, leaderSec: 200 }).detail).toBe(
      '+0:00 vs leader'
    );
    expect(liveSegmentLine({ ...base, prSec: null, leaderSec: null }).detail).toBe('1:40');
  });
});

describe('createLiveSegmentTracker', () => {
  it('stays quiet away from every segment', () => {
    const tracker = createLiveSegmentTracker([segment()]);
    expect(tracker.update(at(0, 72.9))).toBeNull();
    expect(tracker.update(at(1, 72.9))).toBeNull();
  });

  it('reports the effort once past the start gate, with time and distance', () => {
    const tracker = createLiveSegmentTracker([segment()]);
    let status = null;
    for (let i = 0; i <= 15; i++) status = tracker.update(at(i));
    expect(status?.key).toBe('seg');
    expect(status?.elapsedSec).toBeGreaterThan(0);
    expect(status?.coveredM).toBeGreaterThan(30);
  });

  it('stops reporting once the end gate is reached', () => {
    const tracker = createLiveSegmentTracker([segment()]);
    let status = null;
    for (let i = 0; i <= 36; i++) status = tracker.update(at(i));
    expect(status).toBeNull();
  });

  it('drops an effort that walks the wrong way', () => {
    const tracker = createLiveSegmentTracker([segment()]);
    for (let i = 4; i <= 8; i++) tracker.update(at(i));
    let status = null;
    for (let i = 0; i < 80; i++) status = tracker.update(at(-i, 72.8777, 19.076 + 5 * STEP_DEG));
    expect(status).toBeNull();
  });

  it('forgets efforts on a segment that is no longer in the set', () => {
    const tracker = createLiveSegmentTracker([segment()]);
    for (let i = 4; i <= 15; i++) tracker.update(at(i));
    tracker.setSegments([]);
    expect(tracker.update(at(16))).toBeNull();
  });

  it('forgets everything on reset', () => {
    const tracker = createLiveSegmentTracker([segment()]);
    for (let i = 4; i <= 15; i++) tracker.update(at(i));
    tracker.reset();
    expect(tracker.update(at(16))).toBeNull();
  });
});
