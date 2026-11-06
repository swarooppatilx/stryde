import { describe, expect, it } from 'vitest';
import {
  flyoverDurationMs,
  flyoverFrames,
  flyoverProgress,
  frameAt,
  nextFlyoverSpeed,
} from '@/utils/flyover';
import { angleDelta } from '@/utils/geo';

type P = [number, number];

// About 111 m per 0.001 degree of latitude, 105 m per 0.001 of longitude at this latitude.
const EAST: P[] = [
  [73.85, 18.52],
  [73.86, 18.52],
  [73.87, 18.52],
];
const L_SHAPE: P[] = [
  [73.85, 18.52],
  [73.86, 18.52],
  [73.86, 18.53],
];

describe('flyoverFrames', () => {
  it('has nothing to show for no route or a route that goes nowhere', () => {
    expect(flyoverFrames([], 60)).toEqual([]);
    expect(flyoverFrames([[73.85, 18.52]], 60)).toEqual([]);
    expect(
      flyoverFrames(
        [
          [73.85, 18.52],
          [73.85, 18.52],
        ],
        60
      )
    ).toEqual([]);
  });

  it('starts at the first point and ends at the last, in order along the route', () => {
    const frames = flyoverFrames(EAST, 60);
    expect(frames).toHaveLength(60);
    expect(frames[0]?.center).toEqual(EAST[0]);
    expect(frames.at(-1)?.center[0]).toBeCloseTo(73.87, 4);
    expect(frames[0]?.progress).toBe(0);
    expect(frames.at(-1)?.progress).toBe(1);
    for (let i = 1; i < frames.length; i++) {
      expect((frames[i]?.distance ?? 0) > (frames[i - 1]?.distance ?? 0)).toBe(true);
    }
  });

  it('faces the way the route is going', () => {
    const frames = flyoverFrames(EAST, 60);
    for (const f of frames) expect(Math.abs(angleDelta(90, f.bearing))).toBeLessThan(5);
  });

  it('turns through a corner gradually instead of snapping, along the short way round', () => {
    const frames = flyoverFrames(L_SHAPE, 120);
    let biggest = 0;
    for (let i = 1; i < frames.length; i++) {
      biggest = Math.max(
        biggest,
        Math.abs(angleDelta(frames[i - 1]?.bearing ?? 0, frames[i]?.bearing ?? 0))
      );
    }
    // A 90 degree corner spread over many frames: no single step is anywhere near the full turn.
    expect(biggest).toBeLessThan(30);
    // And it still ends up heading north.
    expect(Math.abs(angleDelta(0, frames.at(-1)?.bearing ?? 90))).toBeLessThan(20);
  });
});

describe('frameAt', () => {
  const frames = flyoverFrames(EAST, 60);

  it('gives the first and last frame at the ends and clamps outside them', () => {
    expect(frameAt(frames, 0)).toEqual(frames[0]);
    expect(frameAt(frames, 1)).toEqual(frames.at(-1));
    expect(frameAt(frames, -3)).toEqual(frames[0]);
    expect(frameAt(frames, 7)).toEqual(frames.at(-1));
  });

  it('sits between two frames for a progress between them', () => {
    const a = frames[10] as (typeof frames)[number];
    const b = frames[11] as (typeof frames)[number];
    const mid = frameAt(frames, (a.progress + b.progress) / 2);
    expect(mid?.center[0]).toBeCloseTo((a.center[0] + b.center[0]) / 2, 6);
  });

  it('turns the short way across north when blending 350 to 10 degrees', () => {
    const wrap = [
      { progress: 0, distance: 0, center: [0, 0] as P, bearing: 350 },
      { progress: 1, distance: 10, center: [0, 1] as P, bearing: 10 },
    ];
    const mid = frameAt(wrap, 0.5);
    expect(Math.abs(angleDelta(0, mid?.bearing ?? 180))).toBeLessThan(1);
  });

  it('has no frame to give when there are none', () => {
    expect(frameAt([], 0.5)).toBeNull();
  });
});

describe('flyoverDurationMs', () => {
  it('runs longer for a longer route but never too short or too long', () => {
    expect(flyoverDurationMs(100, 1)).toBe(12_000);
    expect(flyoverDurationMs(5_000, 1)).toBeGreaterThan(flyoverDurationMs(1_000, 1));
    expect(flyoverDurationMs(500_000, 1)).toBe(60_000);
  });

  it('plays faster at 2x and 4x', () => {
    expect(flyoverDurationMs(5_000, 2)).toBe(flyoverDurationMs(5_000, 1) / 2);
    expect(flyoverDurationMs(5_000, 4)).toBe(flyoverDurationMs(5_000, 1) / 4);
  });
});

describe('nextFlyoverSpeed', () => {
  it('cycles 1x, 2x, 4x and back to 1x', () => {
    expect(nextFlyoverSpeed(1)).toBe(2);
    expect(nextFlyoverSpeed(2)).toBe(4);
    expect(nextFlyoverSpeed(4)).toBe(1);
  });

  it('starts over from 1x for a speed it does not know', () => {
    expect(nextFlyoverSpeed(3)).toBe(1);
  });
});

describe('flyoverProgress', () => {
  it('advances by the share of the duration that has passed and stops at the end', () => {
    expect(flyoverProgress(0, 5_000, 20_000)).toBeCloseTo(0.25, 5);
    expect(flyoverProgress(0.5, 5_000, 20_000)).toBeCloseTo(0.75, 5);
    expect(flyoverProgress(0.9, 5_000, 20_000)).toBe(1);
  });

  it('does not move for a zero duration', () => {
    expect(flyoverProgress(0.3, 1_000, 0)).toBe(0.3);
  });
});
