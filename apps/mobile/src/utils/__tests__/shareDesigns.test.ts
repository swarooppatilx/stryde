import { describe, expect, it } from 'vitest';
import {
  availableShareDesigns,
  firstSharePhoto,
  resolveShareDesign,
  shareCardStats,
} from '@/utils/shareDesigns';

describe('availableShareDesigns', () => {
  it('offers route and stats cards, and the photo card only with a photo', () => {
    expect(availableShareDesigns(undefined)).toEqual(['route', 'stats']);
    expect(availableShareDesigns('file:///a.jpg')).toEqual(['route', 'stats', 'photo']);
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
