import { logger } from '@/utils/logger';
import { pickHourIndex, type Weather } from '@/utils/weather';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
// The forecast service keeps about 92 days of past hours; older ones live only in the archive
// (which lags the present by a few days, hence not using it for recent activities).
const FORECAST_KEEPS_DAYS = 80;
const DAY_MS = 86_400_000;
const FETCH_TIMEOUT_MS = 10_000;

interface Hourly {
  time: string[];
  temperature_2m: number[];
  precipitation: number[];
  weather_code: number[];
  wind_speed_10m: number[];
}

const cache = new Map<string, Weather | null>();

export function clearWeatherCache(): void {
  cache.clear();
}

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * The weather where and when an activity started, from Open-Meteo (no key). Null for a start in
 * the future, when the service cannot answer, or when the hour is missing: weather is a nicety,
 * never a reason for an error.
 */
export async function getWeatherAt({
  lat,
  lng,
  at,
  now = new Date(),
}: {
  lat: number;
  lng: number;
  at: Date;
  now?: Date;
}): Promise<Weather | null> {
  const atMs = at.getTime();
  if (atMs > now.getTime()) return null;

  // Two decimals is about a kilometre: close enough that a run and its neighbour share an answer.
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}:${new Date(atMs).toISOString().slice(0, 13)}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  const recent = now.getTime() - atMs < FORECAST_KEEPS_DAYS * DAY_MS;
  // A day either side, because the dates are the place's local ones and `at` is an instant.
  const url =
    `${recent ? FORECAST_URL : ARCHIVE_URL}` +
    `?latitude=${lat}&longitude=${lng}` +
    `&start_date=${isoDate(atMs - DAY_MS)}&end_date=${isoDate(Math.min(atMs + DAY_MS, now.getTime()))}` +
    '&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m&timezone=auto';

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) return null;
    const data = (await response.json()) as { utc_offset_seconds?: number; hourly?: Hourly };
    const hourly = data.hourly;
    if (!hourly) return null;
    const index = pickHourIndex(hourly.time, atMs, data.utc_offset_seconds ?? 0);
    if (index === null) return null;
    const weather: Weather = {
      temperatureC: hourly.temperature_2m[index] as number,
      windKph: hourly.wind_speed_10m[index] as number,
      precipitationMm: hourly.precipitation[index] as number,
      code: hourly.weather_code[index] as number,
    };
    cache.set(key, weather);
    return weather;
  } catch (error) {
    logger.warn('[Weather] lookup failed:', error);
    return null;
  }
}
