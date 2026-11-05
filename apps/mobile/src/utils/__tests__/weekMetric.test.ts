import { describe, expect, it } from 'vitest';
import { METRIC_OPTIONS, metricText, metricValue } from '@/utils/weekMetric';

const week = { start: new Date(2026, 9, 25), count: 3, distance: 12_500, duration: 5_400_000 };

describe('metricValue', () => {
  it('reads the figure for the chosen metric', () => {
    expect(metricValue(week, 'distance')).toBe(12_500);
    expect(metricValue(week, 'time')).toBe(5_400_000);
    expect(metricValue(week, 'activities')).toBe(3);
  });
});

describe('metricText', () => {
  it('writes each figure the way it is shown elsewhere', () => {
    expect(metricText(12_500, 'distance', 'metric')).toBe('12.50km');
    expect(metricText(5_400_000, 'time', 'metric')).toBe('1h 30m');
    expect(metricText(3, 'activities', 'metric')).toBe('3');
  });

  it('follows the unit system for distance', () => {
    expect(metricText(1609.344, 'distance', 'imperial')).toBe('1.00mi');
  });
});

describe('METRIC_OPTIONS', () => {
  it('offers distance first, then time and activities', () => {
    expect(METRIC_OPTIONS.map((o) => o.value)).toEqual(['distance', 'time', 'activities']);
  });
});
