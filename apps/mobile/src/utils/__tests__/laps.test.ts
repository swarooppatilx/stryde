import { describe, expect, it } from 'vitest';
import { lapSummary, lapsFromMarks, latestLap } from '@/utils/laps';

describe('lapsFromMarks', () => {
  it('is empty when the athlete never pressed lap', () => {
    expect(lapsFromMarks([], { distance: 5000, duration: 1_500_000 })).toEqual([]);
  });

  it('cuts the run at each mark and closes the last lap at the finish', () => {
    const laps = lapsFromMarks(
      [
        { distance: 1000, duration: 300_000 },
        { distance: 2500, duration: 780_000 },
      ],
      { distance: 3200, duration: 1_010_000 }
    );

    expect(laps).toEqual([
      { index: 1, distance: 1000, duration: 300_000 },
      { index: 2, distance: 1500, duration: 480_000 },
      { index: 3, distance: 700, duration: 230_000 },
    ]);
  });

  it('skips a second press at the same moment, so a double tap makes one lap', () => {
    const laps = lapsFromMarks(
      [
        { distance: 1000, duration: 300_000 },
        { distance: 1000, duration: 300_000 },
      ],
      { distance: 2000, duration: 600_000 }
    );

    expect(laps.map((l) => l.index)).toEqual([1, 2]);
  });

  it('drops a final stretch that is empty, because the last press was at the finish line', () => {
    const laps = lapsFromMarks([{ distance: 2000, duration: 600_000 }], {
      distance: 2000,
      duration: 600_000,
    });

    expect(laps).toEqual([{ index: 1, distance: 2000, duration: 600_000 }]);
  });
});

describe('latestLap', () => {
  it('is the stretch just closed by the newest mark', () => {
    const marks = [
      { distance: 1000, duration: 300_000 },
      { distance: 2100, duration: 640_000 },
    ];

    expect(latestLap(marks)).toEqual({ index: 2, distance: 1100, duration: 340_000 });
  });

  it('is null before any lap was marked, and for a repeated mark that adds nothing', () => {
    expect(latestLap([])).toBeNull();
    expect(
      latestLap([
        { distance: 1000, duration: 300_000 },
        { distance: 1000, duration: 300_000 },
      ])?.index
    ).toBe(1);
  });
});

describe('lapSummary', () => {
  it('says which lap it was, how long it took and how far it went', () => {
    expect(lapSummary({ index: 3, distance: 1000, duration: 312_000 }, 'metric')).toBe(
      'Lap 3 · 5m 12s · 1.00km'
    );
  });
});
