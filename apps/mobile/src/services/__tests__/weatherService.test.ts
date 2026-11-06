import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearWeatherCache, getWeatherAt } from '@/services/weatherService';

const NOW = new Date(Date.UTC(2026, 10, 6, 12, 0));

const body = {
  utc_offset_seconds: 19_800,
  hourly: {
    time: ['2026-11-05T20:00', '2026-11-05T21:00', '2026-11-05T22:00'],
    temperature_2m: [27.1, 26.4, 25.8],
    precipitation: [0, 0.4, 0],
    weather_code: [1, 61, 3],
    wind_speed_10m: [6.1, 8.2, 7.4],
  },
};

function respond(status: number, json: unknown) {
  const fetchMock = vi.fn(async (_url: string) => Response.json(json, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('getWeatherAt', () => {
  beforeEach(clearWeatherCache);
  afterEach(() => vi.unstubAllGlobals());

  it('returns the conditions for the hour the activity started in', async () => {
    respond(200, body);
    const at = new Date(Date.UTC(2026, 10, 5, 15, 40)); // 21:10 local

    const weather = await getWeatherAt({ lat: 18.52, lng: 73.85, at, now: NOW });

    expect(weather).toEqual({
      temperatureC: 26.4,
      windKph: 8.2,
      precipitationMm: 0.4,
      code: 61,
    });
  });

  it('asks the forecast service (which keeps recent days) for a recent activity', async () => {
    const fetchMock = respond(200, body);
    await getWeatherAt({
      lat: 18.52,
      lng: 73.85,
      at: new Date(Date.UTC(2026, 10, 5, 15, 40)),
      now: NOW,
    });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('https://api.open-meteo.com/v1/forecast');
    expect(url).toContain('latitude=18.52');
    expect(url).toContain('longitude=73.85');
    expect(url).toContain('timezone=auto');
    expect(url).toContain('start_date=2026-11-04');
    expect(url).toContain('end_date=2026-11-06');
  });

  it('asks the archive for an activity older than the forecast keeps', async () => {
    const fetchMock = respond(200, body);
    await getWeatherAt({
      lat: 18.52,
      lng: 73.85,
      at: new Date(Date.UTC(2026, 4, 5, 15, 40)),
      now: NOW,
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      'https://archive-api.open-meteo.com/v1/archive'
    );
  });

  it('has nothing to say for the future or when the service cannot answer', async () => {
    respond(200, body);
    expect(
      await getWeatherAt({ lat: 18.52, lng: 73.85, at: new Date(Date.UTC(2026, 10, 7)), now: NOW })
    ).toBeNull();
    respond(500, { reason: 'down' });
    expect(
      await getWeatherAt({
        lat: 18.5,
        lng: 73.8,
        at: new Date(Date.UTC(2026, 10, 5, 15, 40)),
        now: NOW,
      })
    ).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      })
    );
    expect(
      await getWeatherAt({
        lat: 18.4,
        lng: 73.7,
        at: new Date(Date.UTC(2026, 10, 5, 15, 40)),
        now: NOW,
      })
    ).toBeNull();
  });

  it('does not ask twice for the same place and hour', async () => {
    const fetchMock = respond(200, body);
    const args = {
      lat: 18.5201,
      lng: 73.8501,
      at: new Date(Date.UTC(2026, 10, 5, 15, 40)),
      now: NOW,
    };
    await getWeatherAt(args);
    await getWeatherAt({ ...args, lat: 18.5204, lng: 73.8504 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
