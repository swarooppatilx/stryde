import { describe, expect, it } from 'vitest';
import type { Location } from '@/types';
import {
  classifyFix,
  MAX_FIX_ACCURACY_M,
  MAX_TELEPORT_REJECTS,
  MIN_PLAUSIBLE_FIX_TIME_MS,
} from '@/utils/fixClassifier';

const T0 = 1_700_000_000_000;
const M_PER_DEG = 111_320;

const fix = (over: Partial<Location> & { northM?: number; t?: number }): Location => ({
  latitude: 18.5 + (over.northM ?? 0) / M_PER_DEG,
  longitude: 73.8,
  timestamp: T0 + (over.t ?? 0) * 1000,
  accuracy: 5,
  ...(over.speed !== undefined && { speed: over.speed }),
  ...(over.accuracy !== undefined && { accuracy: over.accuracy }),
});

const run = { maxSpeedMs: 25 / 3.6, consecutiveTeleports: 0 };

describe('classifyFix', () => {
  it('accepts the first fix of a run', () => {
    expect(classifyFix(fix({}), undefined, run)).toBe('accept');
  });

  it('accepts ordinary running', () => {
    expect(classifyFix(fix({ northM: 30, t: 10 }), fix({}), run)).toBe('accept');
  });

  it('ignores a fix with poor accuracy, however plausible its position', () => {
    const poor = fix({ northM: 20, t: 10, accuracy: MAX_FIX_ACCURACY_M + 1 });
    expect(classifyFix(poor, fix({}), run)).toBe('ignore-accuracy');
  });

  it('treats an accuracy of 0 as unknown rather than perfect or terrible', () => {
    expect(classifyFix(fix({ northM: 30, t: 10, accuracy: 0 }), fix({}), run)).toBe('accept');
  });

  it('ignores a fix stamped before 2020, from a device clock that was never set', () => {
    const unset = { ...fix({ northM: 30 }), timestamp: MIN_PLAUSIBLE_FIX_TIME_MS - 1 };
    expect(classifyFix(unset, undefined, run)).toBe('ignore-clock');
    expect(classifyFix({ ...unset, timestamp: 5_000 }, fix({}), run)).toBe('ignore-clock');
    expect(classifyFix({ ...unset, timestamp: MIN_PLAUSIBLE_FIX_TIME_MS }, undefined, run)).toBe(
      'accept'
    );
  });

  it('ignores a fix that is not newer than the last one', () => {
    expect(classifyFix(fix({ northM: 10, t: 0 }), fix({ t: 0 }), run)).toBe('ignore-backwards');
    expect(classifyFix(fix({ northM: 10, t: -2 }), fix({}), run)).toBe('ignore-backwards');
  });

  it('ignores standing jitter smaller than a few meters', () => {
    expect(classifyFix(fix({ northM: 2, t: 2 }), fix({}), run)).toBe('ignore-jitter');
  });

  it('ignores a fix less than 2 s after the last one, however far it is', () => {
    expect(classifyFix(fix({ northM: 10, t: 1 }), fix({}), run)).toBe('ignore-jitter');
  });

  it('ignores a step under 3 m and accepts one over it, 2 s on', () => {
    expect(classifyFix(fix({ northM: 2.5, t: 2 }), fix({}), run)).toBe('ignore-jitter');
    expect(classifyFix(fix({ northM: 3.5, t: 2 }), fix({}), run)).toBe('accept');
  });

  it('ignores a speed spike that the sport allows but no body could reach in 2 s', () => {
    const ride = {
      maxSpeedMs: 120 / 3.6,
      consecutiveTeleports: 0,
      beforePrevious: fix({ northM: -1, t: -10 }),
    };
    // 60 m in 2 s is 30 m/s, under a ride's cap, but from a standstill that is 15 m/s².
    expect(classifyFix(fix({ northM: 60, t: 2 }), fix({}), ride)).toBe('ignore-acceleration');
  });

  it('accepts a hard sprint start, which is far below a spike', () => {
    const sprint = { ...run, beforePrevious: fix({ northM: -1, t: -10 }) };
    expect(classifyFix(fix({ northM: 12, t: 2 }), fix({}), sprint)).toBe('accept');
  });

  it('does not judge acceleration without an earlier fix to take a speed from', () => {
    const ride = { maxSpeedMs: 120 / 3.6, consecutiveTeleports: 0 };
    expect(classifyFix(fix({ northM: 60, t: 2 }), fix({}), ride)).toBe('accept');
  });

  it('ignores a jump faster than the sport allows', () => {
    expect(classifyFix(fix({ northM: 200, t: 5 }), fix({}), run)).toBe('ignore-teleport');
  });

  it("catches the measured 672 m jump at 24 m accuracy after a quiet spell, using the chip's own speed", () => {
    // Two minutes since the last fix makes 672 m look like a brisk 5.6 m/s, within what a run
    // allows; but the chip says the athlete was nearly stationary.
    const jump = fix({ northM: 672, t: 120, accuracy: 24, speed: 0.4 });
    expect(classifyFix(jump, fix({}), run)).toBe('ignore-teleport');
  });

  it('does not mistake a long gap at steady speed for a teleport', () => {
    const steady = fix({ northM: 360, t: 120, speed: 3 });
    expect(classifyFix(steady, fix({}), run)).toBe('accept');
  });

  it('does not use a speed that is not there', () => {
    expect(classifyFix(fix({ northM: 360, t: 120 }), fix({}), run)).toBe('accept');
  });

  it('lets a faster sport go faster', () => {
    const ride = { maxSpeedMs: 70 / 3.6, consecutiveTeleports: 0 };
    expect(classifyFix(fix({ northM: 150, t: 10, speed: 15 }), fix({}), ride)).toBe('accept');
  });

  it('after several rejected jumps in a row, accepts the next as the new reference: the track really moved', () => {
    const far = fix({ northM: 2000, t: 5 });
    expect(classifyFix(far, fix({}), { ...run, consecutiveTeleports: MAX_TELEPORT_REJECTS })).toBe(
      'accept'
    );
  });
});
