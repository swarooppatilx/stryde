import { describe, expect, it } from 'vitest';
import type { Activity } from '@/types';
import {
  coachErrorMessage,
  localDay,
  recentHistory,
  toCoachRun,
  toCoachVitals,
} from '@/utils/coachRun';

const NOW = new Date('2026-11-06T09:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

function activity(id: string, daysAgo: number, extra: Partial<Activity> = {}): Activity {
  return {
    id,
    userId: 'u',
    activityType: 'run',
    distance: 5012.4,
    duration: 1_680_600,
    polyline: '',
    territory: null,
    territoryArea: 0,
    createdAt: new Date(NOW - daysAgo * DAY),
    ...extra,
  } as Activity;
}

describe('toCoachRun', () => {
  it('rounds the numbers and carries the debrief', () => {
    expect(
      toCoachRun(activity('a', 1, { elevationGain: 42.7 }), { summary: 'Heavy legs.', effort: 7 })
    ).toEqual({
      activityType: 'run',
      distanceM: 5012,
      durationS: 1681,
      elevationGainM: 43,
      startedAt: new Date(NOW - DAY).toISOString(),
      debrief: 'Heavy legs.',
      effort: 7,
    });
  });

  it('prefers the first GPS fix over the save time', () => {
    const startedAt = NOW - 2 * DAY;
    const run = toCoachRun(activity('a', 1, { stream: { startedAt } as Activity['stream'] }));
    expect(run.startedAt).toBe(new Date(startedAt).toISOString());
  });
});

describe('toCoachVitals', () => {
  it('turns splits, heart rate, cadence and stops into what the coach reads', () => {
    const t = Array.from({ length: 40 }, (_, i) => i * 45);
    const vitals = toCoachVitals(
      activity('a', 0, {
        splits: [
          { index: 1, distance: 1000, movingTime: 320_000, elevation: 4.4 },
          { index: 2, distance: 1000, movingTime: 335_000 },
          { index: 3, distance: 120, movingTime: 40_000 },
        ],
        heartRate: { avg: 151.6, max: 178 },
        stream: {
          t: [0, 1800],
          speed: [3, 3],
          heartRate: { t, bpm: t.map((s) => (s < 900 ? 140 : 156)) },
          cadence: { t: [0, 1, 2], spm: [0, 166, 170] },
        },
        feel: 'good',
      }),
      { maxHr: 190 }
    );

    expect(vitals.splits).toEqual([
      { index: 1, paceS: 320, elevationM: 4 },
      { index: 2, paceS: 335 },
    ]);
    expect(vitals.heartRate).toEqual({ avg: 152, max: 178, driftBpm: 16 });
    expect(vitals.zones?.length).toBeGreaterThan(0);
    expect(vitals.maxHr).toBe(190);
    expect(vitals.cadenceSpm).toBe(168);
    expect(vitals.stoppedS).toBe(119);
    expect(vitals.feel).toBe('good');
  });

  it('is empty for a manual entry', () => {
    expect(toCoachVitals(activity('a', 0))).toEqual({});
  });
});

describe('recentHistory', () => {
  it('keeps the last two weeks of real activities, newest first', () => {
    const list = [
      activity('old', 20),
      activity('b', 3),
      activity('mock', 1, { mocked: true }),
      activity('a', 1),
    ];
    const history = recentHistory(list, { a: { summary: 'Felt great', effort: 3 } }, NOW);
    expect(history.map((r) => r.debrief ?? r.startedAt.slice(0, 10))).toEqual([
      'Felt great',
      '2026-11-03',
    ]);
  });
});

describe('localDay', () => {
  it('formats the local date', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('coachErrorMessage', () => {
  const UNREACHABLE = "The coach can't be reached right now. Check your connection and try again.";

  it('keeps a readable message from the server', () => {
    expect(coachErrorMessage(new Error("You have used today's coach reviews."))).toBe(
      "You have used today's coach reviews."
    );
  });

  it.each([
    'fetch failed: java.io.IOException: unexpected end of stream on http://localhost:3000/...',
    'Network request failed',
    'Failed to fetch',
    'The operation was aborted due to timeout',
    'connect ECONNREFUSED 127.0.0.1:3000',
  ])('hides a technical network error: %s', (message) => {
    expect(coachErrorMessage(new Error(message))).toBe(UNREACHABLE);
  });

  it('never shows a URL', () => {
    expect(coachErrorMessage(new Error('Bad gateway at https://api.example.com/coach'))).toBe(
      UNREACHABLE
    );
  });

  it('falls back for anything that is not an error', () => {
    expect(coachErrorMessage('boom')).toBe('Something went wrong. Try again.');
    expect(coachErrorMessage(new Error(''))).toBe('Something went wrong. Try again.');
  });
});
