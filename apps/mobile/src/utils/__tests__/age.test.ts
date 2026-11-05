import { describe, expect, it } from 'vitest';
import { ageOn, birthdayStep, MIN_AGE, meetsMinimumAge } from '@/utils/age';

const born = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const today = new Date(2026, 9, 23); // 23 Oct 2026

describe('ageOn', () => {
  it('counts whole years, so a birthday later this year has not happened yet', () => {
    expect(ageOn(born(2000, 10, 24), today)).toBe(25);
    expect(ageOn(born(2000, 10, 23), today)).toBe(26);
    expect(ageOn(born(2000, 1, 1), today)).toBe(26);
  });

  it('is zero for a baby born this year', () => {
    expect(ageOn(born(2026, 1, 1), today)).toBe(0);
  });
});

describe('meetsMinimumAge', () => {
  it('lets someone through on the day they reach the minimum age', () => {
    expect(meetsMinimumAge(born(2026 - MIN_AGE, 10, 23), today)).toBe(true);
  });

  it('turns someone away the day before', () => {
    expect(meetsMinimumAge(born(2026 - MIN_AGE, 10, 24), today)).toBe(false);
  });
});

describe('birthdayStep', () => {
  const NOW = new Date(2026, 10, 5);

  it('needs a birthday: the step cannot be passed without one', () => {
    expect(birthdayStep(null, NOW)).toBe('needed');
  });

  it('refuses someone under the minimum age', () => {
    expect(birthdayStep(new Date(2014, 0, 1), NOW)).toBe('too-young');
  });

  it('lets someone through on the day they turn 13', () => {
    expect(birthdayStep(new Date(2013, 10, 5), NOW)).toBe('ok');
  });

  it('refuses someone who turns 13 tomorrow', () => {
    expect(birthdayStep(new Date(2013, 10, 6), NOW)).toBe('too-young');
  });
});
