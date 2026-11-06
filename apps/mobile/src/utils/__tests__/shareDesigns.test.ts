import { describe, expect, it } from 'vitest';
import {
  availableShareDesigns,
  firstSharePhoto,
  resolveShareDesign,
  SHARE_DESIGN_INFO,
  SHARE_DESIGNS,
  shareCardStats,
  shareExtraStats,
  shareSplitBars,
} from '@/utils/shareDesigns';

describe('SHARE_DESIGN_INFO', () => {
  it('describes every design, with a label and the background it is drawn on', () => {
    for (const id of SHARE_DESIGNS) {
      const info = SHARE_DESIGN_INFO[id];
      expect(info.label.length).toBeGreaterThan(0);
      expect(['transparent', 'dark', 'light', 'photo']).toContain(info.background);
    }
  });

  it('has unique labels so the picker never shows two identical names', () => {
    const labels = SHARE_DESIGNS.map((id) => SHARE_DESIGN_INFO[id].label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('availableShareDesigns', () => {
  it('never offers the photo or splits cards for a bare activity', () => {
    const designs = availableShareDesigns({});
    expect(designs).not.toContain('photo');
    expect(designs).not.toContain('splits');
  });

  it('offers the pace-splits card only when there are at least two splits to compare', () => {
    expect(availableShareDesigns({ splitCount: 1 })).not.toContain('splits');
    expect(availableShareDesigns({ splitCount: 3 })).toContain('splits');
  });

  it('includes the extra story designs for every activity', () => {
    expect(availableShareDesigns({})).toEqual(
      expect.arrayContaining(['route', 'stats', 'big-route', 'minimal', 'receipt'])
    );
  });

  it('adds the photo card only with a photo', () => {
    expect(availableShareDesigns({ photoUri: 'file:///a.jpg' })).toContain('photo');
    expect(availableShareDesigns({ photoUri: undefined })).not.toContain('photo');
  });
});

describe('resolveShareDesign', () => {
  it('keeps a design that is on offer', () => {
    expect(resolveShareDesign('stats', ['route', 'stats'])).toBe('stats');
  });

  it('falls back to the first design when the chosen one is gone', () => {
    expect(resolveShareDesign('photo', ['route', 'stats'])).toBe('route');
  });
});

describe('firstSharePhoto', () => {
  it('is the first photo, if any', () => {
    expect(firstSharePhoto(['a', 'b'])).toBe('a');
    expect(firstSharePhoto([])).toBeUndefined();
    expect(firstSharePhoto(undefined)).toBeUndefined();
  });
});

describe('shareCardStats', () => {
  it('gives distance, time and pace for a run', () => {
    expect(
      shareCardStats({ activityType: 'run', distance: 5000, duration: 1_800_000 }, 'metric')
    ).toEqual([
      { label: 'Distance', value: '5.00km' },
      { label: 'Time', value: '00:30:00' },
      { label: 'Pace', value: '6:00/km' },
    ]);
  });

  it('shows speed for a ride and leaves pace out without distance', () => {
    const ride = shareCardStats(
      { activityType: 'ride', distance: 20_000, duration: 3_600_000 },
      'metric'
    );
    expect(ride.map((s) => s.label)).toEqual(['Distance', 'Time', 'Speed']);
    const yoga = shareCardStats(
      { activityType: 'yoga', distance: 0, duration: 1_800_000 },
      'metric'
    );
    expect(yoga.map((s) => s.label)).toEqual(['Time']);
  });
});

describe('shareExtraStats', () => {
  const base = { activityType: 'run' as const, distance: 5000, duration: 1_800_000 };

  it('adds elevation, heart rate and calories only when the activity has them', () => {
    expect(shareExtraStats(base, 'metric')).toEqual([]);
    expect(
      shareExtraStats(
        { ...base, elevationGain: 42.4, heartRate: { avg: 151.6, max: 178 }, caloriesBurned: 312 },
        'metric'
      )
    ).toEqual([
      { label: 'Elevation', value: '42m' },
      { label: 'Heart rate', value: '152 bpm' },
      { label: 'Calories', value: '312 kcal' },
    ]);
  });

  it('shows elevation in feet for imperial and skips a zero climb', () => {
    expect(shareExtraStats({ ...base, elevationGain: 100 }, 'imperial')).toEqual([
      { label: 'Elevation', value: '328ft' },
    ]);
    expect(shareExtraStats({ ...base, elevationGain: 0 }, 'metric')).toEqual([]);
  });
});

describe('shareSplitBars', () => {
  const splits = [
    { index: 1, distance: 1000, movingTime: 300_000 },
    { index: 2, distance: 1000, movingTime: 330_000 },
    { index: 3, distance: 500, movingTime: 170_000 },
  ];

  it('labels each split with its pace and sizes the bar against the fastest', () => {
    const bars = shareSplitBars(splits, 'run', 'metric');
    expect(bars.map((b) => b.pace)).toEqual(['5:00/km', '5:30/km', '5:40/km']);
    expect(bars[0]?.ratio).toBe(1);
    expect(bars[1]?.ratio).toBeCloseTo(300 / 330, 5);
    expect(bars[2]?.ratio).toBeCloseTo(300 / 340, 5);
  });

  it('labels a short last split by the distance it covered', () => {
    expect(shareSplitBars(splits, 'run', 'metric').map((b) => b.label)).toEqual(['1', '2', '0.5']);
  });

  it('skips splits with no distance or time instead of dividing by zero', () => {
    const bars = shareSplitBars(
      [{ index: 1, distance: 0, movingTime: 0 }, ...splits],
      'run',
      'metric'
    );
    expect(bars).toHaveLength(3);
  });

  it('caps the list so the card stays readable', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      index: i + 1,
      distance: 1000,
      movingTime: 300_000,
    }));
    expect(shareSplitBars(many, 'run', 'metric').length).toBeLessThanOrEqual(12);
  });
});
