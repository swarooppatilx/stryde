import { describe, expect, it } from 'vitest';
import {
  type CoachRequestEntry,
  entryCost,
  entryTime,
  entryTitle,
  entryTrust,
  kindLabel,
  newestFirst,
} from '@/utils/coachRequests';

const entry = (over: Partial<CoachRequestEntry> = {}): CoachRequestEntry => ({
  at: new Date(2026, 10, 6, 14, 5).getTime(),
  kind: 'plan',
  calls: [
    {
      requestId: 'req_1',
      model: 'glm-5.3',
      teeVerified: null,
      trustMode: 'verified',
      costUsdMicro: 900,
    },
  ],
  costUsdMicro: 900,
  adjusted: false,
  ...over,
});

const NOW = new Date(2026, 10, 6, 20, 0);

describe('entry labels', () => {
  it('names each kind of result', () => {
    expect(kindLabel('plan')).toBe('Daily plan');
    expect(kindLabel('review')).toBe('Run review');
    expect(kindLabel('poster')).toBe('Run poster');
    expect(kindLabel('debrief')).toBe('Voice debrief');
  });

  it('says when a plan was adjusted for safety', () => {
    expect(entryTitle(entry())).toBe('Daily plan');
    expect(entryTitle(entry({ adjusted: true }))).toBe('Daily plan · adjusted for safety');
  });
});

describe('entryTime', () => {
  it('reads today and yesterday in the athlete’s own time', () => {
    expect(entryTime(entry().at, NOW)).toBe('Today 14:05');
    expect(entryTime(new Date(2026, 10, 5, 9, 30).getTime(), NOW)).toBe('Yesterday 09:30');
  });

  it('treats just before and just after midnight as different days', () => {
    const now = new Date(2026, 10, 6, 0, 10);
    expect(entryTime(new Date(2026, 10, 5, 23, 55).getTime(), now)).toBe('Yesterday 23:55');
    expect(entryTime(new Date(2026, 10, 6, 0, 5).getTime(), now)).toBe('Today 00:05');
  });

  it('gives a date for older entries', () => {
    expect(entryTime(new Date(2026, 10, 3, 18, 20).getTime(), NOW)).toBe('3 Nov 18:20');
  });

  it('is empty for an unreadable time', () => {
    expect(entryTime(Number.NaN, NOW)).toBe('');
  });
});

describe('entryTrust and entryCost', () => {
  it('labels the entry from its calls', () => {
    expect(entryTrust(entry())?.label).toBe('TEE only');
    expect(
      entryTrust(
        entry({
          calls: [
            {
              requestId: 'a',
              model: 'm',
              teeVerified: true,
              trustMode: 'verified',
              costUsdMicro: 1,
            },
          ],
        })
      )?.label
    ).toBe('TEE verified');
    expect(
      entryTrust(
        entry({
          calls: [
            {
              requestId: 'a',
              model: 'm',
              teeVerified: null,
              trustMode: 'standard',
              costUsdMicro: 1,
            },
          ],
        })
      )?.label
    ).toBe('Standard provider, not TEE');
  });

  it('formats the cost, or none', () => {
    expect(entryCost(entry())).toBe('$0.0009');
    expect(entryCost(entry({ costUsdMicro: null }))).toBeNull();
  });
});

describe('newestFirst', () => {
  it('sorts without changing the input', () => {
    const a = entry({ at: 1 });
    const b = entry({ at: 3 });
    const c = entry({ at: 2 });
    const input = [a, b, c];
    expect(newestFirst(input)).toEqual([b, c, a]);
    expect(input).toEqual([a, b, c]);
    expect(newestFirst([])).toEqual([]);
  });
});
