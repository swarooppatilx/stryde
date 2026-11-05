import { describe, expect, it } from 'vitest';
import { manualStartedAt, shouldConfirmDiscard, validateManualEntry } from '@/utils/manualActivity';

const base = {
  sport: 'run' as const,
  distanceInput: '5',
  minutesInput: '30',
  metersPerUnit: 1000,
};

describe('validateManualEntry', () => {
  it('accepts a normal run and returns meters and milliseconds', () => {
    expect(validateManualEntry(base)).toEqual({ ok: true, distance: 5000, duration: 1_800_000 });
  });

  it('reads comma decimals and miles', () => {
    expect(
      validateManualEntry({
        ...base,
        distanceInput: '3,1',
        metersPerUnit: 1609.344,
        minutesInput: '40',
      })
    ).toMatchObject({ ok: true, distance: 4989 });
  });

  it('asks for a distance when the sport is measured by distance', () => {
    expect(validateManualEntry({ ...base, distanceInput: '' })).toEqual({
      ok: false,
      reason: 'Enter the distance',
    });
  });

  it('lets a sport with no distance be logged by time alone', () => {
    expect(validateManualEntry({ ...base, sport: 'yoga', distanceInput: '' })).toEqual({
      ok: true,
      distance: 0,
      duration: 1_800_000,
    });
  });

  it('asks for a duration, and caps it at 72 hours', () => {
    expect(validateManualEntry({ ...base, minutesInput: '' })).toEqual({
      ok: false,
      reason: 'Enter how long it took',
    });
    expect(validateManualEntry({ ...base, minutesInput: '5000' })).toEqual({
      ok: false,
      reason: 'Duration is too long (max 72 hours)',
    });
  });

  it('rejects text, negatives and absurd distances', () => {
    expect(validateManualEntry({ ...base, distanceInput: 'abc' }).ok).toBe(false);
    expect(validateManualEntry({ ...base, distanceInput: '-5' }).ok).toBe(false);
    expect(validateManualEntry({ ...base, distanceInput: '5000', minutesInput: '4000' })).toEqual({
      ok: false,
      reason: 'Distance is too large (max 1,000 km)',
    });
  });

  it('rejects a pace no human could hold: 5000 km in a minute', () => {
    const result = validateManualEntry({ ...base, distanceInput: '900', minutesInput: '1' });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toMatch(/faster than possible for a run/i);
  });

  it('allows a ride at a speed that would be impossible for a run', () => {
    expect(
      validateManualEntry({ ...base, sport: 'ride', distanceInput: '40', minutesInput: '60' }).ok
    ).toBe(true);
  });
});

describe('duration as hours and minutes', () => {
  const timeless = { sport: 'run', distanceInput: '5', metersPerUnit: 1000 } as const;

  it('reads 1:30 as an hour and a half', () => {
    const result = validateManualEntry({ ...timeless, minutesInput: '1:30' });
    expect(result).toEqual({ ok: true, distance: 5000, duration: 90 * 60_000 });
  });

  it('reads 0:45 and 12:05', () => {
    expect(validateManualEntry({ ...timeless, minutesInput: '0:45' })).toMatchObject({
      duration: 45 * 60_000,
    });
    expect(
      validateManualEntry({
        ...timeless,
        minutesInput: '12:05',
        sport: 'ride',
        distanceInput: '20',
      })
    ).toMatchObject({
      duration: 725 * 60_000,
    });
  });

  it('rejects minutes of 60 or more after the colon, and a bare colon', () => {
    expect(validateManualEntry({ ...timeless, minutesInput: '1:75' }).ok).toBe(false);
    expect(validateManualEntry({ ...timeless, minutesInput: ':' }).ok).toBe(false);
    expect(validateManualEntry({ ...timeless, minutesInput: '1:' }).ok).toBe(false);
  });

  it('still reads a plain number as minutes', () => {
    expect(validateManualEntry({ ...timeless, minutesInput: '30' })).toMatchObject({
      duration: 30 * 60_000,
    });
  });
});

describe('manualStartedAt', () => {
  const NOW = new Date(2026, 9, 21, 15, 30).getTime();

  it('is undefined when the selected time is now', () => {
    expect(manualStartedAt(new Date(2026, 9, 21, 15, 30), NOW)).toBeUndefined();
  });

  it('keeps a selected time on an earlier day', () => {
    expect(manualStartedAt(new Date(2026, 9, 19, 9, 45), NOW)).toBe(
      new Date(2026, 9, 19, 9, 45).getTime()
    );
  });

  it('keeps an earlier time selected today', () => {
    expect(manualStartedAt(new Date(2026, 9, 21, 8, 15), NOW)).toBe(
      new Date(2026, 9, 21, 8, 15).getTime()
    );
  });

  it('does not create a future start time today', () => {
    expect(manualStartedAt(new Date(2026, 9, 21, 18, 0), NOW)).toBeUndefined();
  });

  it('is never in the future, even if a later day slips through', () => {
    expect(manualStartedAt(new Date(2026, 9, 25), NOW)).toBeUndefined();
  });
});

describe('shouldConfirmDiscard', () => {
  const untouched = {
    recorded: false,
    titleEdited: false,
    description: '',
    photoCount: 0,
    distanceInput: '',
    minutesInput: '',
  };

  it('does not nag about a form nobody touched', () => {
    expect(shouldConfirmDiscard(untouched)).toBe(false);
  });

  it('asks before throwing away anything the user typed or added', () => {
    expect(shouldConfirmDiscard({ ...untouched, titleEdited: true })).toBe(true);
    expect(shouldConfirmDiscard({ ...untouched, description: 'felt great' })).toBe(true);
    expect(shouldConfirmDiscard({ ...untouched, photoCount: 1 })).toBe(true);
    expect(shouldConfirmDiscard({ ...untouched, distanceInput: '5' })).toBe(true);
    expect(shouldConfirmDiscard({ ...untouched, minutesInput: '30' })).toBe(true);
    expect(shouldConfirmDiscard({ ...untouched, privateNote: 'knee' })).toBe(true);
    expect(shouldConfirmDiscard({ ...untouched, privateNote: '  ' })).toBe(false);
  });

  it('always asks before dropping a recorded activity, even if untouched', () => {
    expect(shouldConfirmDiscard({ ...untouched, recorded: true })).toBe(true);
  });
});
