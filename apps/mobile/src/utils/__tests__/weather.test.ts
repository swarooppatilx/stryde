import { describe, expect, it } from 'vitest';
import { describeWeather, formatWeatherLine, pickHourIndex } from '@/utils/weather';

describe('pickHourIndex', () => {
  const times = ['2026-11-05T20:00', '2026-11-05T21:00', '2026-11-05T22:00'];

  it('finds the hour the activity started in, in the place it happened', () => {
    // 15:40 UTC is 21:10 in India (+05:30), so the 21:00 slot.
    const at = Date.UTC(2026, 10, 5, 15, 40);
    expect(pickHourIndex(times, at, 5.5 * 3600)).toBe(1);
  });

  it('is null when that hour is not in the list', () => {
    const at = Date.UTC(2026, 10, 6, 15, 40);
    expect(pickHourIndex(times, at, 5.5 * 3600)).toBeNull();
  });

  it('uses the offset of the place: the same instant is a different hour elsewhere', () => {
    const at = Date.UTC(2026, 10, 5, 20, 5);
    expect(pickHourIndex(times, at, 0)).toBe(0);
  });
});

describe('describeWeather', () => {
  it('names the common WMO codes and picks an icon', () => {
    expect(describeWeather(0)).toEqual({ label: 'Clear', icon: 'sunny-outline' });
    expect(describeWeather(2).label).toBe('Partly cloudy');
    expect(describeWeather(3).label).toBe('Overcast');
    expect(describeWeather(61).label).toBe('Rain');
    expect(describeWeather(73).label).toBe('Snow');
    expect(describeWeather(95).label).toBe('Thunderstorm');
  });

  it('falls back to a plain label for a code it does not know', () => {
    expect(describeWeather(999)).toEqual({ label: 'Weather', icon: 'cloud-outline' });
  });
});

describe('formatWeatherLine', () => {
  const w = { temperatureC: 24.4, windKph: 8.2, precipitationMm: 0, code: 2 };

  it('reads condition, temperature and wind in metric', () => {
    expect(formatWeatherLine(w, 'metric')).toBe('Partly cloudy · 24°C · Wind 8 km/h');
  });

  it('converts to Fahrenheit and mph for imperial', () => {
    expect(formatWeatherLine({ ...w, temperatureC: 20, windKph: 16.09 }, 'imperial')).toBe(
      'Partly cloudy · 68°F · Wind 10 mph'
    );
  });

  it('mentions rain only when there was some', () => {
    expect(formatWeatherLine({ ...w, code: 61, precipitationMm: 1.26 }, 'metric')).toContain(
      '1.3 mm'
    );
    expect(formatWeatherLine(w, 'metric')).not.toContain('mm');
  });
});
