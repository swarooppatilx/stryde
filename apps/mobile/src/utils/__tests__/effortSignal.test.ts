import { describe, expect, it } from 'vitest';
import type { Activity } from '@/types';
import { effortSignal } from '@/utils/effortSignal';

function run(extra: Partial<Activity> = {}): Activity {
  return {
    id: 'a',
    userId: 'u',
    activityType: 'run',
    distance: 5000,
    duration: 1_800_000,
    polyline: '',
    territory: null,
    territoryArea: 0,
    createdAt: new Date('2026-11-05T07:00:00Z'),
    ...extra,
  } as Activity;
}

/** One reading a minute for `minutes`, all at `bpm`. */
const heartRate = (bpm: number, minutes = 30) => ({
  t: Array.from({ length: minutes + 1 }, (_, i) => i * 60),
  bpm: Array.from({ length: minutes + 1 }, () => bpm),
});
const withStream = (hr: { t: number[]; bpm: number[] }) =>
  ({ stream: { t: hr.t, speed: hr.t.map(() => 3), heartRate: hr } }) as Partial<Activity>;
const PROFILE = { maxHr: 190 };

describe('effortSignal: debrief first', () => {
  it('reads a high debrief effort or a tough feel as hard', () => {
    expect(effortSignal(run(), { effort: 7, feel: null })).toBe('hard');
    expect(effortSignal(run(), { effort: null, feel: 'tough' })).toBe('hard');
    expect(effortSignal(run(), { effort: 2, feel: 'bad' })).toBe('hard');
  });

  it('reads a low or middling debrief effort as easy or moderate', () => {
    expect(effortSignal(run(), { effort: 3, feel: 'great' })).toBe('easy');
    expect(effortSignal(run(), { effort: 5, feel: 'ok' })).toBe('moderate');
    expect(effortSignal(run(), { effort: 6, feel: null })).toBe('moderate');
  });

  it('beats what the activity itself says', () => {
    expect(effortSignal(run({ effort: 'max' }), { effort: 2, feel: 'good' })).toBe('easy');
  });

  it('falls through when the debrief has an upbeat feel but no effort', () => {
    expect(effortSignal(run({ effort: 'hard' }), { effort: null, feel: 'great' })).toBe('hard');
    expect(effortSignal(run(), { effort: null, feel: 'good' })).toBeNull();
  });
});

describe('effortSignal: activity effort and feel', () => {
  it('maps the marked effort', () => {
    expect(effortSignal(run({ effort: 'easy' }))).toBe('easy');
    expect(effortSignal(run({ effort: 'moderate' }))).toBe('moderate');
    expect(effortSignal(run({ effort: 'hard' }))).toBe('hard');
    expect(effortSignal(run({ effort: 'max' }))).toBe('hard');
  });

  it('prefers the marked effort over the marked feel', () => {
    expect(effortSignal(run({ effort: 'easy', feel: 'terrible' }))).toBe('easy');
  });

  it('reads a bad or terrible feel as hard, and ignores a good one', () => {
    expect(effortSignal(run({ feel: 'bad' }))).toBe('hard');
    expect(effortSignal(run({ feel: 'terrible' }))).toBe('hard');
    expect(effortSignal(run({ feel: 'great' }))).toBeNull();
  });
});

describe('effortSignal: heart-rate zones', () => {
  it('reads a quarter of the time in zones 4 and 5 as hard', () => {
    const hr = { t: [] as number[], bpm: [] as number[] };
    for (let i = 0; i <= 40; i++) {
      hr.t.push(i * 60);
      hr.bpm.push(i < 30 ? 120 : 180); // 10 of 40 minutes at ~95% of max
    }
    expect(effortSignal(run(withStream(hr)), null, PROFILE)).toBe('hard');
  });

  it('reads steady zone 3 as moderate and steady zone 1 as easy', () => {
    expect(effortSignal(run(withStream(heartRate(145))), null, PROFILE)).toBe('moderate');
    expect(effortSignal(run(withStream(heartRate(125))), null, PROFILE)).toBe('easy');
  });

  it('needs a max heart rate and readings to say anything', () => {
    expect(effortSignal(run(withStream(heartRate(180))), null, {})).toBeNull();
    expect(effortSignal(run(withStream({ t: [], bpm: [] })), null, PROFILE)).toBeNull();
  });
});

describe('effortSignal: no signal', () => {
  it('is null for a bare run', () => {
    expect(effortSignal(run())).toBeNull();
    expect(effortSignal(run(), null, PROFILE)).toBeNull();
    expect(effortSignal(run(), undefined)).toBeNull();
  });
});
