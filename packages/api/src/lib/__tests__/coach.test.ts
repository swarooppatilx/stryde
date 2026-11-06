import { describe, expect, it } from 'vitest';
import {
  CoachBudget,
  describeVitals,
  extractJson,
  parseDebrief,
  parsePlan,
  parseReview,
  posterPrompt,
  reviewMessages,
  toRunSummary,
  toVitals,
} from '../coach.js';

const RUN = {
  activityType: 'run',
  distanceM: 5200,
  durationS: 1680,
  startedAt: '2026-11-05T06:30:00Z',
};

describe('extractJson', () => {
  it('reads an object wrapped in fences and chatter', () => {
    expect(extractJson('Sure!\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('returns null when there is no object', () => {
    expect(extractJson('no json here')).toBeNull();
    expect(extractJson('[1, 2]')).toBeNull();
  });
});

const PLAN = {
  title: 'Easy recovery jog',
  type: 'easy',
  distanceKm: 3,
  durationMin: 25,
  effort: 'easy',
  summary: 'Shake out the legs.',
  steps: [
    { label: 'Warm up', detail: '5 min walk' },
    { label: 'Jog', detail: '3 km at 6:30/km' },
  ],
  why: 'Yesterday was your longest run this week.',
};
const plan = (over: Record<string, unknown> = {}) =>
  parsePlan(JSON.stringify({ ...PLAN, ...over }));

describe('parsePlan', () => {
  it('keeps a well-formed structured plan', () => {
    expect(plan()).toMatchObject({
      title: 'Easy recovery jog',
      type: 'easy',
      distanceKm: 3,
      durationMin: 25,
      effort: 'easy',
    });
    expect(plan()?.steps).toHaveLength(2);
  });

  it('rejects a plan without steps or a title', () => {
    expect(
      parsePlan('{"title": "Rest", "type": "rest", "effort": "rest", "steps": []}')
    ).toBeNull();
    expect(plan({ title: '  ' })).toBeNull();
  });

  it('rejects a type or effort outside the enums, or missing', () => {
    expect(plan({ type: 'marathon' })).toBeNull();
    expect(plan({ effort: 'brutal' })).toBeNull();
    expect(plan({ type: undefined })).toBeNull();
    expect(plan({ effort: undefined })).toBeNull();
  });

  it('rejects out-of-range or non-numeric distance and duration', () => {
    expect(plan({ distanceKm: 0 })).toBeNull();
    expect(plan({ distanceKm: -3 })).toBeNull();
    expect(plan({ distanceKm: 61 })).toBeNull();
    expect(plan({ distanceKm: '5' })).toBeNull();
    expect(plan({ durationMin: 301 })).toBeNull();
  });

  it('accepts null or missing figures and rounds the rest', () => {
    expect(plan({ distanceKm: null, durationMin: null })).toMatchObject({
      distanceKm: null,
      durationMin: null,
    });
    expect(plan({ distanceKm: undefined })?.distanceKm).toBeNull();
    expect(plan({ distanceKm: 5.46, durationMin: 30.6 })).toMatchObject({
      distanceKm: 5.5,
      durationMin: 31,
    });
  });

  it('turns a rest day into no distance, no duration and rest effort', () => {
    expect(plan({ type: 'rest', distanceKm: 5, durationMin: 30, effort: 'hard' })).toMatchObject({
      type: 'rest',
      distanceKm: null,
      durationMin: null,
      effort: 'rest',
    });
  });
});

describe('parseDebrief', () => {
  it('keeps only valid effort, feel and tags', () => {
    const debrief = parseDebrief(
      '{"summary": "Hills hurt.", "effort": 8, "feel": "tough", "tags": ["Hills", "sore calves"]}',
      'raw'
    );
    expect(debrief).toEqual({
      summary: 'Hills hurt.',
      effort: 8,
      feel: 'tough',
      tags: ['hills', 'sore calves'],
    });
  });

  it('falls back to the transcript when the reply is unreadable', () => {
    const debrief = parseDebrief('???', 'legs felt heavy');
    expect(debrief).toEqual({ summary: 'legs felt heavy', effort: null, feel: null, tags: [] });
  });

  it('drops an out-of-range effort and an unknown feel', () => {
    const debrief = parseDebrief('{"summary": "ok", "effort": 14, "feel": "meh"}', 'x');
    expect(debrief.effort).toBeNull();
    expect(debrief.feel).toBeNull();
  });
});

describe('posterPrompt', () => {
  it('asks for an image with no text, since the app lays the stats over it', () => {
    const prompt = posterPrompt({ ...RUN, place: 'Mumbai' }, 'proud');
    expect(prompt).toContain('runner');
    expect(prompt).toContain('Mumbai');
    expect(prompt).toContain('proud');
    expect(prompt).toContain('No text');
  });
});

describe('toRunSummary', () => {
  it('accepts a valid activity and drops junk fields', () => {
    expect(toRunSummary({ ...RUN, effort: 11, place: '' })).toEqual(RUN);
  });

  it('rejects missing or invalid numbers and dates', () => {
    expect(toRunSummary({ ...RUN, durationS: 0 })).toBeNull();
    expect(toRunSummary({ ...RUN, startedAt: 'yesterday' })).toBeNull();
    expect(toRunSummary(null)).toBeNull();
  });
});

describe('CoachBudget', () => {
  const wallet = '0x00000000000000000000000000000000000000aa';
  const day = new Date('2026-11-06T10:00:00Z');

  it('allows the daily allowance, then refuses until the next UTC day', () => {
    const budget = new CoachBudget({ plan: 2, poster: 1, debrief: 1, review: 1 });
    expect(budget.take(wallet, 'plan', day)).toBe(true);
    expect(budget.take(wallet, 'plan', day)).toBe(true);
    expect(budget.take(wallet, 'plan', day)).toBe(false);
    expect(budget.take(wallet, 'plan', new Date('2026-11-07T00:00:01Z'))).toBe(true);
  });

  it('gives a failed call back', () => {
    const budget = new CoachBudget({ plan: 1, poster: 1, debrief: 1, review: 1 });
    expect(budget.take(wallet, 'poster', day)).toBe(true);
    budget.refund(wallet, 'poster', day);
    expect(budget.remaining(wallet, 'poster', day)).toBe(1);
  });
});

describe('toVitals', () => {
  it('keeps believable readings and drops the rest', () => {
    const vitals = toVitals({
      splits: [
        { index: 1, paceS: 330.4, elevationM: 12.2 },
        { index: 2, paceS: 5 },
      ],
      heartRate: { avg: 152.4, max: 181, driftBpm: 9 },
      zones: [{ label: 'Tempo', minutes: 12.34 }],
      cadenceSpm: 168,
      powerW: 'lots',
      maxHr: 400,
      feel: 'good',
    });
    expect(vitals).toEqual({
      splits: [{ index: 1, paceS: 330, elevationM: 12 }],
      heartRate: { avg: 152, max: 181, driftBpm: 9 },
      zones: [{ label: 'Tempo', minutes: 12.3 }],
      cadenceSpm: 168,
      feel: 'good',
    });
  });

  it('is empty for nothing usable', () => {
    expect(toVitals(null)).toEqual({});
    expect(toVitals({ heartRate: { avg: 10 } })).toEqual({});
  });
});

describe('reviewMessages', () => {
  it('gives the coach the splits, heart rate and recent log', () => {
    const vitals = toVitals({
      splits: [
        { index: 1, paceS: 320 },
        { index: 2, paceS: 345, elevationM: 20 },
      ],
      heartRate: { avg: 150, max: 175, driftBpm: 8 },
      cadenceSpm: 158,
    });
    const [system, user] = reviewMessages(RUN, vitals, [RUN]);
    expect(system?.content).toContain('JSON only');
    expect(user?.content).toContain('1: 5:20/km, 2: 5:45/km (+20 m)');
    expect(user?.content).toContain('avg 150 bpm, max 175 bpm, second half +8 bpm');
    expect(user?.content).toContain('158 steps/min');
  });

  it('says when there is no sensor data', () => {
    expect(describeVitals({})).toBe('No sensor data beyond distance and time.');
  });
});

describe('parseReview', () => {
  it('keeps a well-formed review', () => {
    const review = parseReview(
      JSON.stringify({
        headline: 'Strong start, faded late',
        summary: 'You ran 5.2 km. The last km slowed.',
        wentWell: ['Fast first km'],
        vitals: [{ label: 'Cadence', reading: '158 spm', note: 'A little low.' }, { label: '' }],
        improve: [{ focus: 'Even pacing', tip: 'Start 10 s/km slower.' }],
        nextRun: 'Easy 4 km tomorrow.',
      })
    );
    expect(review).toMatchObject({
      headline: 'Strong start, faded late',
      vitals: [{ label: 'Cadence', reading: '158 spm' }],
      improve: [{ focus: 'Even pacing' }],
    });
  });

  it('rejects a reply with nothing to improve', () => {
    expect(parseReview('{"headline":"Nice","summary":"Good run."}')).toBeNull();
  });
});
