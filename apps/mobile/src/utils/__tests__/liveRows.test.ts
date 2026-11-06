import { describe, expect, it } from 'vitest';
import { lapRows, splitRows, versusAverage } from '@/utils/liveRows';

const average = { distance: 5000, duration: 25 * 60_000 };

describe('versusAverage', () => {
  it('says how many seconds per km a pace sport is ahead of or behind its average', () => {
    expect(versusAverage('run', { distance: 1000, duration: 288_000 }, average, 'metric')).toEqual({
      text: '-0:12',
      faster: true,
    });
    expect(versusAverage('run', { distance: 1000, duration: 315_000 }, average, 'metric')).toEqual({
      text: '+0:15',
      faster: false,
    });
  });

  it('gives a ride the difference in speed', () => {
    expect(versusAverage('ride', { distance: 1000, duration: 150_000 }, average, 'metric')).toEqual(
      {
        text: '+12 km/h',
        faster: true,
      }
    );
  });

  it('gives nothing when the stretch or the run has no distance yet', () => {
    expect(versusAverage('run', { distance: 0, duration: 1000 }, average, 'metric')).toBeNull();
    expect(
      versusAverage(
        'run',
        { distance: 1000, duration: 1000 },
        { distance: 0, duration: 0 },
        'metric'
      )
    ).toBeNull();
  });

  it('shows no change as level', () => {
    expect(versusAverage('run', { distance: 1000, duration: 300_000 }, average, 'metric')).toEqual({
      text: '0:00',
      faster: false,
    });
  });
});

describe('lapRows and splitRows', () => {
  it('lists the closed laps and then the one still running', () => {
    const rows = lapRows(
      [{ index: 1, distance: 1000, duration: 300_000 }],
      { distance: 400, duration: 120_000 },
      'run',
      average,
      'metric'
    );
    expect(rows.map((r) => r.label)).toEqual(['Lap 1', 'Lap 2']);
    expect(rows[0]).toMatchObject({ time: '5m 0s', pace: '5:00/km', running: false });
    expect(rows[1]).toMatchObject({ time: '2m 0s', running: true });
  });

  it('leaves out a running lap that has not started', () => {
    expect(lapRows([], { distance: 0, duration: 0 }, 'run', average, 'metric')).toEqual([]);
  });

  it('names splits by the unit', () => {
    const splits = [{ index: 1, distance: 1000, movingTime: 290_000 }];
    expect(splitRows(splits, 'run', average, 'metric')[0]).toMatchObject({
      label: 'km 1',
      pace: '4:50/km',
    });
    expect(splitRows(splits, 'run', average, 'imperial')[0]?.label).toBe('mi 1');
  });
});
