import { describe, expect, it } from 'vitest';
import { describeGpsSignal, gpsBars } from '@/utils/gpsSignal';

const NOW = 1_000_000;
const fix = (accuracy: number, ageMs = 1000) => ({ accuracy, timestamp: NOW - ageMs });

describe('describeGpsSignal', () => {
  it('says it is searching until the first fix arrives', () => {
    expect(describeGpsSignal(null, NOW)).toEqual({ level: 'searching', label: 'Acquiring GPS' });
  });

  it('says what to check once the wait has gone on too long', () => {
    expect(describeGpsSignal(null, NOW, { waitingSince: NOW - 3000 }).hint).toBeUndefined();
    expect(describeGpsSignal(null, NOW, { waitingSince: NOW - 9000 })).toEqual({
      level: 'searching',
      label: 'Acquiring GPS',
      hint: 'Make sure location is on and you have a clear view of the sky.',
    });
  });

  it('is good for a recent, accurate fix', () => {
    expect(describeGpsSignal(fix(8), NOW)).toEqual({ level: 'good', label: 'GPS signal acquired' });
  });

  it('warns when the fix is imprecise', () => {
    expect(describeGpsSignal(fix(35), NOW)).toEqual({ level: 'weak', label: 'Weak GPS signal' });
  });

  it('reports a lost signal when nothing has arrived for a while', () => {
    expect(describeGpsSignal(fix(5, 20_000), NOW)).toEqual({
      level: 'lost',
      label: 'No GPS signal',
    });
  });

  it('says location services are off, straight away, whatever else is known', () => {
    const off = {
      level: 'off',
      label: 'Location services off',
      hint: 'Turn on location in your phone settings.',
    };
    expect(describeGpsSignal(null, NOW, { waitingSince: NOW - 100, servicesOn: false })).toEqual(
      off
    );
    expect(describeGpsSignal(fix(5), NOW, { servicesOn: false })).toEqual(off);
  });

  it('says location access is needed when it has not been allowed, with what to do', () => {
    const blocked = describeGpsSignal(null, NOW, { permitted: false });

    expect(blocked.level).toBe('blocked');
    expect(blocked.label).toBe('Location access needed');
    expect(blocked.hint).toBe('Press Start and allow location when asked.');
  });

  it('names services off before missing access, since turning them on comes first', () => {
    expect(describeGpsSignal(null, NOW, { servicesOn: false, permitted: false }).level).toBe('off');
  });

  it('treats services as on when nothing says otherwise', () => {
    expect(describeGpsSignal(fix(5), NOW, { servicesOn: true }).level).toBe('good');
    expect(describeGpsSignal(fix(5), NOW).level).toBe('good');
  });

  it('prefers "lost" over "weak" when both apply', () => {
    expect(describeGpsSignal(fix(50, 30_000), NOW).level).toBe('lost');
  });
});

describe('gpsBars', () => {
  it.each([
    ['good', 4, 'success'],
    ['weak', 2, 'warning'],
    ['searching', 0, 'muted'],
    ['lost', 0, 'danger'],
    ['off', 0, 'danger'],
    ['blocked', 0, 'warning'],
  ] as const)('shows a %s signal as %i lit bars in the %s tone', (level, lit, tone) => {
    expect(gpsBars(level)).toEqual({ total: 4, lit, tone });
  });
});
