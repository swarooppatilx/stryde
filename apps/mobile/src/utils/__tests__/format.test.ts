import { describe, expect, it } from 'vitest';
import type { User } from '../../types';
import {
  formatArea,
  formatDistance,
  formatDuration,
  formatDurationLong,
  formatPace,
  formatRelativeTime,
  getActivityName,
  getDisplayName,
  getInitials,
  parsePolyline,
} from '../format';

describe('formatDistance', () => {
  it('formats meters when < 1000', () => {
    expect(formatDistance(0)).toBe('0m');
    expect(formatDistance(500)).toBe('500m');
    expect(formatDistance(999)).toBe('999m');
  });

  it('formats kilometers when >= 1000', () => {
    expect(formatDistance(1000)).toBe('1.00km');
    expect(formatDistance(1500)).toBe('1.50km');
    expect(formatDistance(12345)).toBe('12.35km');
  });
});

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(5000)).toBe('5s');
    expect(formatDuration(59000)).toBe('59s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(90000)).toBe('1m 30s');
    expect(formatDuration(3661000)).toBe('1h 1m');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3600000)).toBe('1h 0m');
    expect(formatDuration(5400000)).toBe('1h 30m');
  });
});

describe('formatDurationLong', () => {
  it('pads to HH:MM:SS', () => {
    expect(formatDurationLong(0)).toBe('00:00:00');
    expect(formatDurationLong(3661000)).toBe('01:01:01');
    expect(formatDurationLong(60000)).toBe('00:01:00');
  });
});

describe('formatPace', () => {
  it('returns --:-- when distance is 0', () => {
    expect(formatPace(0, 300000)).toBe('--:--');
  });

  it('calculates pace in min/km', () => {
    // 5 min/km = 5:00/km
    const pace = formatPace(1000, 300_000); // 300s per 1000m
    expect(pace).toBe('5:00/km');
  });

  it('formats fast pace', () => {
    // 3:30/km
    const pace = formatPace(1000, 210_000); // 210s per 1000m
    expect(pace).toBe('3:30/km');
  });
});

describe('formatArea', () => {
  it('formats 0 as 0 acres', () => {
    expect(formatArea(0)).toBe('0 acres');
  });

  it('formats small areas in m²', () => {
    expect(formatArea(10)).toBe('10 m²');
  });

  it('formats larger areas in acres', () => {
    expect(formatArea(4046.86)).toBe('1.00 acres');
    expect(formatArea(10000)).toBe('2.47 acres');
  });
});

describe('parsePolyline', () => {
  it('returns empty array for empty string', () => {
    expect(parsePolyline('')).toEqual([]);
  });

  it('parses single point', () => {
    expect(parsePolyline('1.5,2.5')).toEqual([[1.5, 2.5]]);
  });

  it('parses multiple semicolon-separated points', () => {
    expect(parsePolyline('1,2;3,4;5,6')).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it('filters out invalid coordinates', () => {
    expect(parsePolyline('1,2;abc,def;3,4')).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});

describe('getInitials', () => {
  it('returns first two letters uppercased', () => {
    expect(getInitials('john doe')).toBe('JD');
  });

  it('returns single initial for single name', () => {
    expect(getInitials('alice')).toBe('A');
  });

  it('returns max two characters', () => {
    expect(getInitials('alice bob charlie')).toBe('AB');
  });
});

describe('getDisplayName', () => {
  it('returns firstName + lastName when both present', () => {
    const user = { firstName: 'John', lastName: 'Doe', username: 'jdoe' } as User;
    expect(getDisplayName(user)).toBe('John Doe');
  });

  it('returns firstName when no lastName', () => {
    const user = { firstName: 'John', lastName: '', username: 'jdoe' } as User;
    expect(getDisplayName(user)).toBe('John');
  });

  it('returns username as fallback', () => {
    const user = { firstName: '', lastName: '', username: 'jdoe' } as User;
    expect(getDisplayName(user)).toBe('jdoe');
  });

  it('returns Unknown when nothing is set', () => {
    const user = { firstName: '', lastName: '', username: '' } as User;
    expect(getDisplayName(user)).toBe('Unknown');
  });
});

describe('getActivityName', () => {
  it('returns Morning for hour < 12', () => {
    expect(getActivityName('run', 8)).toBe('Morning Run');
  });

  it('returns Afternoon for hour 12-16', () => {
    expect(getActivityName('ride', 14)).toBe('Afternoon Ride');
  });

  it('returns Evening for hour >= 17', () => {
    expect(getActivityName('walk', 20)).toBe('Evening Walk');
  });

  it('falls back to Activity for unknown type', () => {
    expect(getActivityName('surfing', 10)).toBe('Morning Activity');
  });
});

describe('formatRelativeTime', () => {
  it('returns "just now" for very recent times', () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  it('returns minutes ago', () => {
    const d = new Date(Date.now() - 5 * 60_000);
    expect(formatRelativeTime(d)).toBe('5m ago');
  });

  it('returns compact minutes', () => {
    const d = new Date(Date.now() - 5 * 60_000);
    expect(formatRelativeTime(d, true)).toBe('5m');
  });

  it('returns hours ago', () => {
    const d = new Date(Date.now() - 3 * 3600_000);
    expect(formatRelativeTime(d)).toBe('3h ago');
  });

  it('returns "yesterday" for 1 day ago (non-compact)', () => {
    const d = new Date(Date.now() - 86400_000);
    expect(formatRelativeTime(d)).toBe('yesterday');
  });

  it('returns compact days', () => {
    const d = new Date(Date.now() - 2 * 86400_000);
    expect(formatRelativeTime(d, true)).toBe('2d');
  });
});
