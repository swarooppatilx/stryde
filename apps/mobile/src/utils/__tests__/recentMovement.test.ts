import { describe, expect, it } from 'vitest';
import { LIVE_SPEED_STALE_MS, MIN_CHIP_SPEED_MS, recentMovement } from '@/utils/recentMovement';

// About 11.1 m per 0.0001 degree of latitude.
const fix = (seconds: number, lat: number) => ({
  latitude: lat,
  longitude: 77,
  timestamp: seconds * 1000,
});

describe('recentMovement', () => {
  it('measures only the last window, so a pace shown now is the pace being run now', () => {
    const locations = [
      fix(0, 18.0),
      fix(10, 18.001), // a fast start, far outside the window
      fix(100, 18.0011),
      fix(110, 18.0012),
      fix(115, 18.00125),
    ];

    const { distance, durationMs } = recentMovement(locations, 20_000);

    // From the fix at 100 s: 0.00015 degrees of latitude, about 17 m in 15 s.
    expect(durationMs).toBe(15_000);
    expect(distance).toBeGreaterThan(15);
    expect(distance).toBeLessThan(19);
  });

  it('has nothing to say with fewer than two fixes in the window', () => {
    expect(recentMovement([], 15_000)).toEqual({ distance: 0, durationMs: 0 });
    expect(recentMovement([fix(0, 18)], 15_000)).toEqual({ distance: 0, durationMs: 0 });
    expect(recentMovement([fix(0, 18), fix(100, 18.001)], 15_000)).toEqual({
      distance: 0,
      durationMs: 0,
    });
  });

  it('uses the whole track when it is shorter than the window', () => {
    const { durationMs } = recentMovement([fix(0, 18), fix(6, 18.0001)], 15_000);

    expect(durationMs).toBe(6_000);
  });
});

describe("recentMovement with the GPS chip's own speed", () => {
  const withSpeed = (seconds: number, lat: number, speed?: number) => ({
    ...fix(seconds, lat),
    ...(speed !== undefined && { speed }),
  });
  const track = [withSpeed(100, 18.0011), withSpeed(110, 18.0012), withSpeed(115, 18.00125, 4)];

  it('uses it while it is fresh: the pace answers the athlete at once', () => {
    const { distance, durationMs } = recentMovement(track, 20_000, 115_500);

    // 4 m/s over one second.
    expect(durationMs).toBe(1000);
    expect(distance).toBe(4);
  });

  it('reads zero once the last fix is older than three seconds: a frozen GPS is not a pace', () => {
    expect(recentMovement(track, 20_000, 115_000 + LIVE_SPEED_STALE_MS + 1)).toEqual({
      distance: 0,
      durationMs: 0,
    });
    expect(recentMovement(track, 20_000, 115_000 + LIVE_SPEED_STALE_MS).durationMs).toBe(1000);
  });

  it('lets slower fix cadences widen the window so a 5 s interval does not flicker to zero', () => {
    const at = 115_000 + 6_000;
    expect(recentMovement(track, 20_000, at, 10_000).durationMs).toBe(15_000);
    expect(recentMovement(track, 20_000, at)).toEqual({ distance: 0, durationMs: 0 });
  });

  it('ignores a speed so low it is only the chip jittering while standing', () => {
    const slow = [...track.slice(0, 2), withSpeed(115, 18.00125, MIN_CHIP_SPEED_MS - 0.05)];

    expect(recentMovement(slow, 20_000, 115_500).durationMs).toBe(15_000);
  });

  it('falls back when the fix carries no speed, or when no time is given', () => {
    const plain = [fix(100, 18.0011), fix(110, 18.0012), fix(115, 18.00125)];
    expect(recentMovement(plain, 20_000, 115_500).durationMs).toBe(15_000);
    expect(recentMovement(track, 20_000).durationMs).toBe(15_000);
  });
});
