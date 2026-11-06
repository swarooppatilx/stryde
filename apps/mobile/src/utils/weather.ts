import type { Ionicons } from '@expo/vector-icons';
import type { UnitSystem } from '@/utils/format';

export interface Weather {
  temperatureC: number;
  windKph: number;
  precipitationMm: number;
  /** WMO weather code from the forecast service. */
  code: number;
}

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * The index of the hour slot an activity started in. The service answers in the place's own clock
 * (`timezone=auto`), so the instant is shifted by that place's UTC offset before it is matched.
 */
export function pickHourIndex(
  times: readonly string[],
  atMs: number,
  utcOffsetSeconds: number
): number | null {
  const local = new Date(atMs + utcOffsetSeconds * 1000).toISOString().slice(0, 13);
  const index = times.findIndex((t) => t.slice(0, 13) === local);
  return index === -1 ? null : index;
}

/** WMO code groups (https://open-meteo.com/en/docs): the words a runner would use, and an icon for each. */
export function describeWeather(code: number): { label: string; icon: IconName } {
  if (code === 0) return { label: 'Clear', icon: 'sunny-outline' };
  if (code === 1 || code === 2) return { label: 'Partly cloudy', icon: 'partly-sunny-outline' };
  if (code === 3) return { label: 'Overcast', icon: 'cloudy-outline' };
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'cloud-outline' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: 'rainy-outline' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return { label: 'Rain', icon: 'rainy-outline' };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { label: 'Snow', icon: 'snow-outline' };
  }
  if (code >= 95 && code <= 99) return { label: 'Thunderstorm', icon: 'thunderstorm-outline' };
  return { label: 'Weather', icon: 'cloud-outline' };
}

const KM_PER_MILE = 1.609344;

/** "Partly cloudy · 24°C · Wind 8 km/h", with the rain total added only when it rained. */
export function formatWeatherLine(weather: Weather, unitSystem: UnitSystem): string {
  const imperial = unitSystem === 'imperial';
  const temperature = imperial
    ? `${Math.round((weather.temperatureC * 9) / 5 + 32)}°F`
    : `${Math.round(weather.temperatureC)}°C`;
  const wind = imperial
    ? `${Math.round(weather.windKph / KM_PER_MILE)} mph`
    : `${Math.round(weather.windKph)} km/h`;
  const parts = [describeWeather(weather.code).label, temperature, `Wind ${wind}`];
  if (weather.precipitationMm >= 0.1) {
    parts.push(
      imperial
        ? `${(weather.precipitationMm / 25.4).toFixed(2)} in`
        : `${weather.precipitationMm.toFixed(1)} mm`
    );
  }
  return parts.join(' · ');
}
