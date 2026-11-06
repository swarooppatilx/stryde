import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIVE_STAT_SLOTS,
  LIVE_STAT_FIELDS,
  LIVE_STAT_SLOT_COUNT,
  type LiveStatData,
  type LiveStatId,
  liveStatChoices,
  liveStatFamily,
  resolveLiveStatLayout,
  sanitizeLiveStatSlots,
  withLiveStatSlot,
} from '@/utils/liveStats';

const moving: LiveStatData = {
  distance: 5000,
  duration: 25 * 60_000,
  recent: { distance: 50, durationMs: 15_000 },
  territoryArea: null,
  elevationGain: 42,
  lapCount: 2,
  lastLap: { index: 2, distance: 1000, duration: 4 * 60_000 + 30_000 },
  laps: [],
  fixAgeMs: 1000,
  altitude: 123.4,
  currentLap: { distance: 600, duration: 3 * 60_000 },
  splits: [
    { index: 1, distance: 1000, movingTime: 5 * 60_000 },
    { index: 2, distance: 1000, movingTime: 4 * 60_000 + 50_000 },
  ],
};

const justStarted: LiveStatData = {
  distance: 0,
  duration: 0,
  recent: { distance: 0, durationMs: 0 },
  territoryArea: null,
  elevationGain: null,
  lapCount: 0,
  lastLap: null,
  laps: [],
  fixAgeMs: null,
  altitude: null,
  currentLap: { distance: 0, duration: 0 },
  splits: [],
};

const field = (id: LiveStatId) => LIVE_STAT_FIELDS[id];

describe('liveStatFamily', () => {
  it('reads rides and skates in speed, and everything else in pace', () => {
    expect(liveStatFamily('ride')).toBe('speed');
    expect(liveStatFamily('skate')).toBe('speed');
    expect(liveStatFamily('run')).toBe('pace');
    expect(liveStatFamily('walk')).toBe('pace');
    expect(liveStatFamily('swim')).toBe('pace');
  });
});

describe('field values', () => {
  it('formats time, distance and climb in metric and imperial', () => {
    expect(field('time').value(moving, 'metric')).toBe('00:25:00');
    expect(field('distance').value(moving, 'metric')).toBe('5.00km');
    expect(field('distance').value(moving, 'imperial')).toBe('3.11mi');
    expect(field('climb').value(moving, 'metric')).toBe('42m');
    expect(field('climb').value(moving, 'imperial')).toBe('138ft');
  });

  it('gives a run its pace and a ride its speed, per kilometre or mile', () => {
    expect(field('avgPace').value(moving, 'metric')).toBe('5:00/km');
    expect(field('avgPace').value(moving, 'imperial')).toBe('8:02/mi');
    expect(field('avgSpeed').value(moving, 'metric')).toBe('12 km/h');
    expect(field('avgSpeed').value(moving, 'imperial')).toBe('7 mph');
    expect(field('currentPace').value(moving, 'metric')).toBe('5:00/km');
    expect(field('currentSpeed').value(moving, 'metric')).toBe('12 km/h');
  });

  it('labels the averages with their unit, as the screen always has', () => {
    expect(field('avgPace').label('metric')).toBe('Avg Pace /km');
    expect(field('avgPace').label('imperial')).toBe('Avg Pace /mi');
    expect(field('avgSpeed').label('metric')).toBe('Avg Speed km/h');
    expect(field('avgSpeed').label('imperial')).toBe('Avg Speed mph');
    expect(field('currentPace').label('metric')).toBe('Right now');
  });

  it('shows the latest split and lap', () => {
    expect(field('lastSplitPace').value(moving, 'metric')).toBe('4:50/km');
    expect(field('lastSplitPace').label('metric')).toBe('Last km');
    expect(field('lastSplitSpeed').label('imperial')).toBe('Last mi');
    expect(field('lastLapPace').value(moving, 'metric')).toBe('4:30/km');
    expect(field('lastLapSpeed').value(moving, 'metric')).toBe('13 km/h');
    expect(field('laps').value(moving, 'metric')).toBe('2');
  });

  it('shows a dash, never NaN, before there is anything to measure', () => {
    for (const id of Object.keys(LIVE_STAT_FIELDS) as LiveStatId[]) {
      for (const unitSystem of ['metric', 'imperial'] as const) {
        const value = field(id).value(justStarted, unitSystem);
        expect(value, id).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
    expect(field('avgPace').value(justStarted, 'metric')).toBe('--:--');
    expect(field('avgSpeed').value(justStarted, 'metric')).toBe('--');
    expect(field('currentPace').value(justStarted, 'metric')).toBe('--:--');
    expect(field('lastSplitPace').value(justStarted, 'metric')).toBe('—');
    expect(field('lastLapSpeed').value(justStarted, 'metric')).toBe('—');
    expect(field('territory').value(justStarted, 'metric')).toBe('—');
    expect(field('climb').value(justStarted, 'metric')).toBe('—');
  });

  it('shows a dash when a value is missing or broken rather than a number', () => {
    const broken = {
      ...moving,
      distance: Number.NaN,
      duration: Number.POSITIVE_INFINITY,
      recent: { distance: Number.NaN, durationMs: 1000 },
    };
    expect(field('distance').value(broken, 'metric')).toBe('—');
    expect(field('time').value(broken, 'metric')).toBe('—');
    expect(field('avgPace').value(broken, 'metric')).toBe('—');
    expect(field('currentSpeed').value(broken, 'metric')).toBe('—');
  });

  it('marks territory as earned once the route closes into a loop', () => {
    const looped = { ...moving, territoryArea: 2500 };
    expect(field('territory').value(looped, 'metric')).toBe('2,500 m²');
    expect(field('territory').tone?.(looped)).toBe('success');
    expect(field('territory').tone?.(moving)).toBeUndefined();
  });

  it('counts climb as unavailable while the phone gives no altitude', () => {
    expect(field('climb').available?.(justStarted)).toBe(false);
    expect(field('climb').available?.(moving)).toBe(true);
  });
});

describe('lap and elevation fields', () => {
  it('shows the running lap: time, distance and pace or speed', () => {
    expect(field('lapTime').value(moving, 'metric')).toBe('00:03:00');
    expect(field('lapDistance').value(moving, 'metric')).toBe('600m');
    expect(field('lapDistance').value(moving, 'imperial')).toBe('1969ft');
    expect(field('lapPace').value(moving, 'metric')).toBe('5:00/km');
    expect(field('lapSpeed').value(moving, 'metric')).toBe('12 km/h');
    expect(field('lapPace').label('metric')).toBe('Lap Pace /km');
    expect(field('lapSpeed').label('imperial')).toBe('Lap Speed mph');
  });

  it('keeps pace fields to foot sports and speed fields to rides', () => {
    expect(liveStatChoices('pace').map((f) => f.id)).toContain('lapPace');
    expect(liveStatChoices('pace').map((f) => f.id)).not.toContain('lapSpeed');
    expect(liveStatChoices('speed').map((f) => f.id)).toContain('lapSpeed');
    expect(liveStatChoices('speed').map((f) => f.id)).toContain('elevation');
  });

  it('shows the height above sea level, in feet for imperial', () => {
    expect(field('elevation').value(moving, 'metric')).toBe('123m');
    expect(field('elevation').value(moving, 'imperial')).toBe('405ft');
    expect(field('elevation').available?.(justStarted)).toBe(false);
    expect(field('elevation').available?.(moving)).toBe(true);
  });

  it('shows dashes at the start of a lap', () => {
    expect(field('lapTime').value(justStarted, 'metric')).toBe('00:00:00');
    expect(field('lapDistance').value(justStarted, 'metric')).toBe('0m');
    expect(field('lapPace').value(justStarted, 'metric')).toBe('--:--');
  });
});

describe('stale readings', () => {
  const at = (fixAgeMs: number | null): LiveStatData => ({ ...moving, fixAgeMs });

  it('drops the altitude to a dash once the last fix is older than 5 s', () => {
    expect(field('elevation').value(at(5000), 'metric')).toBe('123m');
    expect(field('elevation').value(at(5001), 'metric')).toBe('—');
    expect(field('elevation').value(at(null), 'metric')).toBe('—');
  });

  it('reads current speed as zero once the GPS speed is older than 3 s', () => {
    expect(field('currentSpeed').value(at(3000), 'metric')).toBe('12 km/h');
    expect(field('currentSpeed').value(at(3001), 'metric')).toBe('0 km/h');
    expect(field('currentSpeed').value(at(3001), 'imperial')).toBe('0 mph');
    expect(field('currentPace').value(at(3001), 'metric')).toBe('—');
  });
});

describe('choices', () => {
  it('offers pace fields to foot sports and speed fields to rides, never both', () => {
    const pace = liveStatChoices('pace').map((f) => f.id);
    const speed = liveStatChoices('speed').map((f) => f.id);
    expect(pace).toContain('avgPace');
    expect(pace).not.toContain('avgSpeed');
    expect(speed).toContain('avgSpeed');
    expect(speed).not.toContain('currentPace');
    for (const shared of ['time', 'distance', 'territory', 'climb', 'laps'] as const) {
      expect(pace).toContain(shared);
      expect(speed).toContain(shared);
    }
  });
});

describe('defaults', () => {
  it('reproduce the screen as it was: time, average, distance, then territory, right now and climb', () => {
    expect(DEFAULT_LIVE_STAT_SLOTS.pace).toEqual([
      'time',
      'avgPace',
      'distance',
      'territory',
      'currentPace',
      'climb',
    ]);
    expect(DEFAULT_LIVE_STAT_SLOTS.speed).toEqual([
      'time',
      'avgSpeed',
      'distance',
      'territory',
      'currentSpeed',
      'climb',
    ]);
  });

  it('only use fields that suit their sport family', () => {
    for (const family of ['pace', 'speed'] as const) {
      expect(DEFAULT_LIVE_STAT_SLOTS[family]).toHaveLength(LIVE_STAT_SLOT_COUNT);
      for (const id of DEFAULT_LIVE_STAT_SLOTS[family]) {
        expect(LIVE_STAT_FIELDS[id].families).toContain(family);
      }
    }
  });
});

describe('resolveLiveStatLayout', () => {
  it('uses the defaults when nothing was saved', () => {
    expect(resolveLiveStatLayout('pace', undefined)).toEqual(DEFAULT_LIVE_STAT_SLOTS.pace);
  });

  it('keeps valid saved choices', () => {
    const saved = ['distance', 'currentPace', 'time', 'laps', 'avgPace', 'lastLapPace'];
    expect(resolveLiveStatLayout('pace', saved)).toEqual(saved);
  });

  it('puts the default back in a slot whose saved id is unknown, unsuitable or not a string', () => {
    const saved = ['vo2max', 'avgSpeed', 'distance', 7, null, 'laps'];
    expect(resolveLiveStatLayout('pace', saved)).toEqual([
      'time',
      'avgPace',
      'distance',
      'territory',
      'currentPace',
      'laps',
    ]);
  });

  it('fills missing slots from the defaults and drops extra ones', () => {
    expect(resolveLiveStatLayout('speed', ['laps'])).toEqual([
      'laps',
      'avgSpeed',
      'distance',
      'territory',
      'currentSpeed',
      'climb',
    ]);
    const tooMany = [...DEFAULT_LIVE_STAT_SLOTS.speed, 'time', 'time'];
    expect(resolveLiveStatLayout('speed', tooMany)).toHaveLength(LIVE_STAT_SLOT_COUNT);
  });

  it('ignores a saved layout that is not a list', () => {
    expect(resolveLiveStatLayout('pace', 'time' as unknown)).toEqual(DEFAULT_LIVE_STAT_SLOTS.pace);
  });

  it('does not let an inherited object key pass as a field', () => {
    expect(resolveLiveStatLayout('pace', ['toString'])[0]).toBe('time');
  });
});

describe('withLiveStatSlot', () => {
  it('changes one slot of one family and leaves the other family alone', () => {
    const next = withLiveStatSlot(DEFAULT_LIVE_STAT_SLOTS, 'pace', 1, 'laps');
    expect(next.pace[1]).toBe('laps');
    expect(next.speed).toEqual(DEFAULT_LIVE_STAT_SLOTS.speed);
  });

  it('swaps with the slot that already shows the chosen field, so nothing appears twice', () => {
    const next = withLiveStatSlot(DEFAULT_LIVE_STAT_SLOTS, 'pace', 0, 'distance');
    expect(next.pace.slice(0, 3)).toEqual(['distance', 'avgPace', 'time']);
  });

  it('refuses a field that does not suit the family, or a slot that does not exist', () => {
    expect(withLiveStatSlot(DEFAULT_LIVE_STAT_SLOTS, 'pace', 0, 'avgSpeed')).toBe(
      DEFAULT_LIVE_STAT_SLOTS
    );
    expect(withLiveStatSlot(DEFAULT_LIVE_STAT_SLOTS, 'pace', 9, 'laps')).toBe(
      DEFAULT_LIVE_STAT_SLOTS
    );
  });

  it('repairs a broken saved layout while changing it', () => {
    const broken = { pace: ['nope'], speed: DEFAULT_LIVE_STAT_SLOTS.speed };
    const next = withLiveStatSlot(broken as never, 'pace', 5, 'laps');
    expect(next.pace).toEqual(['time', 'avgPace', 'distance', 'territory', 'currentPace', 'laps']);
  });
});

describe('sanitizeLiveStatSlots', () => {
  it('gives an install that never saved a layout the defaults', () => {
    expect(sanitizeLiveStatSlots(undefined)).toEqual(DEFAULT_LIVE_STAT_SLOTS);
    expect(sanitizeLiveStatSlots('garbage')).toEqual(DEFAULT_LIVE_STAT_SLOTS);
  });

  it('keeps what is valid in each family and repairs the rest', () => {
    const saved = { pace: ['laps', 'avgSpeed'], speed: 'broken' };
    expect(sanitizeLiveStatSlots(saved)).toEqual({
      pace: ['laps', 'avgPace', 'distance', 'territory', 'currentPace', 'climb'],
      speed: DEFAULT_LIVE_STAT_SLOTS.speed,
    });
  });
});

describe('watch figures', () => {
  const withWatch: LiveStatData = {
    ...moving,
    watch: { state: 'running', heartRate: 151.6, cadence: 171, power: 248.2, calories: 312.7 },
  };

  it('shows the watch readings with their units', () => {
    expect(LIVE_STAT_FIELDS.heartRate.value(withWatch, 'metric')).toBe('152 bpm');
    expect(LIVE_STAT_FIELDS.cadence.value(withWatch, 'metric')).toBe('171 spm');
    expect(LIVE_STAT_FIELDS.power.value(withWatch, 'metric')).toBe('248 W');
    expect(LIVE_STAT_FIELDS.calories.value(withWatch, 'metric')).toBe('313 kcal');
  });

  it('leaves them out without a watch, and dashes them when it drops out', () => {
    expect(LIVE_STAT_FIELDS.heartRate.available?.(moving)).toBe(false);
    const dropped: LiveStatData = { ...moving, watch: { state: 'disconnected' } };
    expect(LIVE_STAT_FIELDS.heartRate.value(dropped, 'metric')).toBe('—');
  });
});
