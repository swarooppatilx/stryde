import { describe, expect, it } from 'vitest';
import { formatDay } from './dates';
import { describeRecoverableRun } from './recoverableRun';

const NOW = Date.UTC(2026, 10, 1, 12, 0, 0);
const MIN = 60_000;

/** Two fixes about 1.11 km apart (0.01 degrees of latitude). */
const FIXES = [
  { latitude: 10, longitude: 20, timestamp: 0, accuracy: 5 },
  { latitude: 10.01, longitude: 20, timestamp: 0, accuracy: 5 },
];

function blob(patch: Record<string, unknown> = {}): string {
  return JSON.stringify({
    locations: FIXES,
    activityType: 'run',
    startTime: NOW - 30 * MIN,
    isTracking: true,
    pausedDuration: 0,
    pauseStartTime: null,
    lastPersistTime: NOW - 6 * MIN,
    ...patch,
  });
}

describe('describeRecoverableRun', () => {
  it('offers nothing for an empty or missing blob', () => {
    expect(describeRecoverableRun(null, NOW)).toBeNull();
    expect(describeRecoverableRun('', NOW)).toBeNull();
    expect(describeRecoverableRun('not json', NOW)).toBeNull();
    expect(describeRecoverableRun('{}', NOW)).toBeNull();
    expect(describeRecoverableRun(blob({ startTime: null }), NOW)).toBeNull();
  });

  it('offers nothing for a start with no fix and no time on the clock', () => {
    const accidental = blob({ locations: [], lastPersistTime: NOW - 30 * MIN + 2000 });
    expect(describeRecoverableRun(accidental, NOW)).toBeNull();
  });

  it('describes a recent run by its distance and the time it was recording', () => {
    const run = describeRecoverableRun(blob(), NOW);
    expect(run).not.toBeNull();
    expect(run?.durationMs).toBe(24 * MIN);
    expect(run?.distanceM).toBeGreaterThan(1100);
    expect(run?.distanceM).toBeLessThan(1120);
    expect(run?.stale).toBe(false);
    expect(run?.tooShort).toBe(false);
    expect(run?.text).toMatch(/^We recovered your run: .*km, 24 min$/);
  });

  it('counts a paused run only up to the moment it was paused', () => {
    const paused = blob({
      isTracking: false,
      pauseStartTime: NOW - 20 * MIN,
      pausedDuration: 2 * MIN,
      lastPersistTime: NOW - 6 * MIN,
    });
    expect(describeRecoverableRun(paused, NOW)?.durationMs).toBe(8 * MIN);
  });

  it('still offers a run older than a day, labelled with its date', () => {
    const old = describeRecoverableRun(
      blob({ startTime: NOW - 50 * 60 * MIN, lastPersistTime: NOW - 49 * 60 * MIN }),
      NOW
    );
    expect(old?.stale).toBe(true);
    expect(old?.text).toContain(formatDay(NOW - 50 * 60 * MIN));
    expect(old?.text).toMatch(/^We found an unfinished run from /);
  });

  it('flags a very short run so the screen can say it will not be kept', () => {
    const short = describeRecoverableRun(
      blob({ locations: FIXES.slice(0, 1), lastPersistTime: NOW - 30 * MIN + 20_000 }),
      NOW
    );
    expect(short?.tooShort).toBe(true);
    expect(short?.text).toContain('under a minute');
  });

  it('speaks miles for imperial', () => {
    expect(describeRecoverableRun(blob(), NOW, 'imperial')?.text).toContain('mi');
  });

  it('falls back to a run for an unknown sport', () => {
    expect(describeRecoverableRun(blob({ activityType: 'zorb' }), NOW)?.activityType).toBe('run');
  });
});
