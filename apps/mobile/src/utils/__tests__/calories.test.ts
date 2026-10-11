import { describe, expect, it } from 'vitest';
import { estimateCalories, formatWeight, parseWeightKg, weightRangeText } from '@/utils/calories';

describe('estimateCalories', () => {
  it('uses about 1 kcal per kg per km for running', () => {
    expect(
      estimateCalories({ activityType: 'run', distance: 10_000, duration: 3_000_000, weightKg: 70 })
    ).toBe(725);
  });

  it('burns less walking than running over the same distance', () => {
    const walk = estimateCalories({
      activityType: 'walk',
      distance: 5000,
      duration: 3_600_000,
      weightKg: 70,
    });
    const run = estimateCalories({
      activityType: 'run',
      distance: 5000,
      duration: 1_500_000,
      weightKg: 70,
    });
    expect(walk).toBeLessThan(run as number);
  });

  it('scales a ride by how fast it was', () => {
    const slow = estimateCalories({
      activityType: 'ride',
      distance: 15_000,
      duration: 3_600_000,
      weightKg: 70,
    });
    const fast = estimateCalories({
      activityType: 'ride',
      distance: 30_000,
      duration: 3_600_000,
      weightKg: 70,
    });
    expect(fast).toBeGreaterThan(slow as number);
  });

  it('says nothing without a weight or without any time', () => {
    expect(
      estimateCalories({ activityType: 'run', distance: 5000, duration: 1_500_000 })
    ).toBeNull();
    expect(
      estimateCalories({ activityType: 'yoga', distance: 0, duration: 0, weightKg: 70 })
    ).toBeNull();
  });

  it('works out sports with no distance from the time spent, by how hard the sport is', () => {
    const hour = (activityType: 'yoga' | 'workout' | 'hiit' | 'swim') =>
      estimateCalories({ activityType, distance: 0, duration: 3_600_000, weightKg: 70 });

    expect(hour('yoga')).toBe(Math.round(2.5 * 70));
    expect(hour('workout')).toBe(Math.round(5 * 70));
    expect(hour('hiit')).toBe(Math.round(8 * 70));
    expect(hour('swim')).toBe(Math.round(7 * 70));
    expect(hour('hiit') as number).toBeGreaterThan(hour('yoga') as number);
  });

  it('still needs a distance for the sports it works out from distance', () => {
    expect(
      estimateCalories({ activityType: 'run', distance: 0, duration: 1_500_000, weightKg: 70 })
    ).toBeNull();
  });
});

describe('weight entry', () => {
  it('reads kilograms and pounds into kilograms', () => {
    expect(parseWeightKg('70', 'metric')).toBe(70);
    expect(parseWeightKg('154', 'imperial')).toBeCloseTo(69.85, 1);
    expect(parseWeightKg('70,5', 'metric')).toBe(70.5);
  });

  it('rejects empty, silly or out-of-range values', () => {
    for (const text of ['', 'abc', '0', '5', '900'])
      expect(parseWeightKg(text, 'metric')).toBeNull();
  });

  it("shows the stored kilograms in the athlete's unit", () => {
    expect(formatWeight(70, 'metric')).toBe('70');
    expect(formatWeight(70, 'imperial')).toBe('154.3');
  });
});

describe('weightRangeText', () => {
  it('states the accepted range in kilograms for metric athletes', () => {
    expect(weightRangeText('metric')).toBe('between 20 and 400 kg');
  });

  it('states it in pounds for imperial athletes, matching what is accepted', () => {
    expect(weightRangeText('imperial')).toBe('between 45 and 881 lb');
    expect(parseWeightKg('45', 'imperial')).not.toBeNull();
    expect(parseWeightKg('881', 'imperial')).not.toBeNull();
    expect(parseWeightKg('44', 'imperial')).toBeNull();
    expect(parseWeightKg('882', 'imperial')).toBeNull();
  });
});
