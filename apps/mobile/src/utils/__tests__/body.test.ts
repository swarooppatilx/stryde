import { describe, expect, it } from 'vitest';
import {
  basalCalories,
  bmi,
  bmiBand,
  formatHeight,
  maxHeartRate,
  parseHeightCm,
  parseMaxHeartRate,
  parseRestingHeartRate,
  summariseBody,
  weightChange,
} from '@/utils/body';

describe('bmi', () => {
  it('is weight over height squared, to one decimal', () => {
    expect(bmi(70, 175)).toBe(22.9);
    expect(bmi(90, 180)).toBe(27.8);
  });

  it('is null without both figures', () => {
    expect(bmi(undefined, 175)).toBeNull();
    expect(bmi(70, undefined)).toBeNull();
    expect(bmi(0, 175)).toBeNull();
  });
});

describe('bmiBand', () => {
  it('uses the usual cut-offs', () => {
    expect(bmiBand(17.9)).toBe('Below the usual range');
    expect(bmiBand(18.5)).toBe('In the usual range');
    expect(bmiBand(24.9)).toBe('In the usual range');
    expect(bmiBand(25)).toBe('Above the usual range');
    expect(bmiBand(30)).toBe('Well above the usual range');
  });
});

describe('basalCalories (Mifflin-St Jeor)', () => {
  const body = { weightKg: 70, heightCm: 175, age: 30 };

  it('differs by sex and takes the midpoint when it is not given', () => {
    expect(basalCalories({ ...body, gender: 'man' })).toBe(1649);
    expect(basalCalories({ ...body, gender: 'woman' })).toBe(1483);
    expect(basalCalories({ ...body, gender: 'non_binary' })).toBe(1566);
    expect(basalCalories({ ...body, gender: 'prefer_not_to_say' })).toBe(1566);
  });

  it('is null when anything it needs is missing', () => {
    expect(basalCalories({ ...body, gender: 'man', age: undefined })).toBeNull();
    expect(basalCalories({ ...body, gender: 'man', heightCm: undefined })).toBeNull();
    expect(basalCalories({ ...body, gender: 'man', weightKg: undefined })).toBeNull();
  });
});

describe('maxHeartRate', () => {
  it('uses 208 minus 0.7 times age, rounded', () => {
    expect(maxHeartRate(30)).toBe(187);
    expect(maxHeartRate(50)).toBe(173);
  });

  it('is null for an unknown or impossible age', () => {
    expect(maxHeartRate(undefined)).toBeNull();
    expect(maxHeartRate(-1)).toBeNull();
    expect(maxHeartRate(130)).toBeNull();
  });
});

describe('parseHeightCm', () => {
  it('reads centimetres', () => {
    expect(parseHeightCm('175', 'metric')).toBe(175);
    expect(parseHeightCm('175,5', 'metric')).toBe(175.5);
  });

  it('reads feet and inches in the usual ways, or plain inches', () => {
    expect(parseHeightCm(`5'10`, 'imperial')).toBeCloseTo(177.8, 1);
    expect(parseHeightCm('5 10', 'imperial')).toBeCloseTo(177.8, 1);
    expect(parseHeightCm('5-10', 'imperial')).toBeCloseTo(177.8, 1);
    expect(parseHeightCm('70', 'imperial')).toBeCloseTo(177.8, 1);
  });

  it('refuses anything outside what a person can be, or not a number', () => {
    expect(parseHeightCm('60', 'metric')).toBeNull();
    expect(parseHeightCm('300', 'metric')).toBeNull();
    expect(parseHeightCm('abc', 'metric')).toBeNull();
    expect(parseHeightCm('', 'imperial')).toBeNull();
  });
});

describe('formatHeight', () => {
  it('writes centimetres or feet and inches', () => {
    expect(formatHeight(175, 'metric')).toBe('175 cm');
    expect(formatHeight(177.8, 'imperial')).toBe(`5'10"`);
  });
});

describe('weightChange', () => {
  const entry = (day: string, kg: number) => ({ day, kg });

  it('is the difference between the newest and the oldest entry in the window', () => {
    const entries = [entry('2026-10-01', 72), entry('2026-10-15', 71), entry('2026-10-28', 70.4)];
    expect(weightChange(entries, 60, '2026-10-28')).toBeCloseTo(-1.6, 5);
  });

  it('ignores entries older than the window', () => {
    const entries = [entry('2026-01-01', 80), entry('2026-10-20', 71), entry('2026-10-28', 70)];
    expect(weightChange(entries, 30, '2026-10-28')).toBeCloseTo(-1, 5);
  });

  it('is null with fewer than two entries in the window', () => {
    expect(weightChange([entry('2026-10-28', 70)], 30, '2026-10-28')).toBeNull();
    expect(weightChange([], 30, '2026-10-28')).toBeNull();
  });
});

describe('summariseBody', () => {
  const now = new Date(2026, 9, 28);

  it('gives every figure when it has everything', () => {
    expect(
      summariseBody({ weightKg: 70, heightCm: 175, birthday: '1996-10-28', gender: 'man' }, now)
    ).toEqual({
      age: 30,
      bmi: 22.9,
      bmiBand: 'In the usual range',
      basalCalories: 1649,
      maxHeartRate: 187,
      maxHeartRateMeasured: false,
    });
  });

  it('leaves out what it cannot work out, and says which age it used', () => {
    expect(summariseBody({ weightKg: 70, gender: 'woman' }, now)).toEqual({
      age: null,
      bmi: null,
      bmiBand: null,
      basalCalories: null,
      maxHeartRate: null,
      maxHeartRateMeasured: false,
    });
    expect(summariseBody({ birthday: '1996-10-28', gender: 'woman' }, now)).toMatchObject({
      age: 30,
      maxHeartRate: 187,
      bmi: null,
    });
  });
});

describe('summariseBody with a measured maximum heart rate', () => {
  const now = new Date(2026, 9, 28);

  it("uses the athlete's own figure instead of the age estimate", () => {
    expect(
      summariseBody({ birthday: '1996-10-28', gender: 'man', maxHeartRate: 199 }, now)
    ).toMatchObject({ maxHeartRate: 199, maxHeartRateMeasured: true });
  });

  it('uses it even without a birthday', () => {
    expect(summariseBody({ gender: 'woman', maxHeartRate: 185 }, now)).toMatchObject({
      maxHeartRate: 185,
      maxHeartRateMeasured: true,
    });
  });
});

describe('parseMaxHeartRate', () => {
  it('reads a whole number of beats per minute', () => {
    expect(parseMaxHeartRate('190')).toBe(190);
    expect(parseMaxHeartRate(' 172 ')).toBe(172);
  });

  it('is null for nothing, for words, and for a figure no heart reaches or is too low to train by', () => {
    expect(parseMaxHeartRate('')).toBeNull();
    expect(parseMaxHeartRate('fast')).toBeNull();
    expect(parseMaxHeartRate('119')).toBeNull();
    expect(parseMaxHeartRate('231')).toBeNull();
    expect(parseMaxHeartRate('180.5')).toBeNull();
  });
});

describe('parseRestingHeartRate', () => {
  it('reads a whole number of beats per minute', () => {
    expect(parseRestingHeartRate('52')).toBe(52);
    expect(parseRestingHeartRate(' 61 ')).toBe(61);
  });

  it('is null for nothing, words, and a figure no resting heart has', () => {
    expect(parseRestingHeartRate('')).toBeNull();
    expect(parseRestingHeartRate('slow')).toBeNull();
    expect(parseRestingHeartRate('29')).toBeNull();
    expect(parseRestingHeartRate('121')).toBeNull();
    expect(parseRestingHeartRate('52.5')).toBeNull();
  });
});
