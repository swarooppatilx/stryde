import { describe, expect, it } from 'vitest';
import type { User } from '@/types';
import { formatDay } from '@/utils/dates';
import {
  activityTitle,
  formatArea,
  formatDistance,
  formatDuration,
  formatDurationLong,
  formatElevation,
  formatMemberCount,
  formatPace,
  formatPaceOrSpeed,
  formatRelativeTime,
  formatSpeed,
  getActivityName,
  getDisplayName,
  getInitials,
  getWeeklyStats,
  paceLabel,
  paceOrSpeedLabel,
  parsePolyline,
  showsSpeed,
  toPolyline,
} from '@/utils/format';

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

describe('speed for sports that are measured in it', () => {
  it('shows speed for riding and skating, pace for everything else', () => {
    expect(showsSpeed('ride')).toBe(true);
    expect(showsSpeed('skate')).toBe(true);
    for (const type of ['run', 'walk', 'hike', 'swim', 'row', 'yoga'] as const) {
      expect(showsSpeed(type)).toBe(false);
    }
  });

  it('formats km/h and mph from distance and time', () => {
    // 25 km in 1 h
    expect(formatSpeed(25_000, 3_600_000)).toBe('25 km/h');
    // 16.0934 km in 1 h is 10 mph
    expect(formatSpeed(16_093.4, 3_600_000, 'imperial')).toBe('10 mph');
  });

  it('shows a placeholder before there is any time or distance', () => {
    expect(formatSpeed(0, 60_000)).toBe('--');
    expect(formatSpeed(1000, 0)).toBe('--');
  });

  it('caps paces slower than an hour instead of rendering "80:00/km"', () => {
    // 1 km in 80 min (an indoor walk that kept a fix): the minute field overflows the mm:ss shape.
    expect(formatPace(1000, 4_800_000)).toBe('> 59:59/km');
    expect(formatPace(1609.34, 4_800_000, 'imperial')).toBe('> 59:59/mi');
    expect(formatPace(1000, 3_599_000)).toBe('59:59/km');
  });

  it('picks the right figure and heading for the sport', () => {
    expect(formatPaceOrSpeed('ride', 20_000, 3_600_000)).toBe('20 km/h');
    expect(formatPaceOrSpeed('run', 1000, 300_000)).toBe('5:00/km');
    expect(paceOrSpeedLabel('ride')).toBe('Speed km/h');
    expect(paceOrSpeedLabel('ride', 'imperial')).toBe('Speed mph');
    expect(paceOrSpeedLabel('run')).toBe('Pace /km');
  });
});

describe('formatArea', () => {
  it('uses metric units for metric users: m² up to a hectare, then hectares', () => {
    expect(formatArea(0)).toBe('0 m²');
    expect(formatArea(10)).toBe('10 m²');
    expect(formatArea(9_999)).toBe('9,999 m²');
    expect(formatArea(25_000)).toBe('2.50 ha');
  });

  it('uses square feet, then acres, for imperial users', () => {
    expect(formatArea(0, 'imperial')).toBe('0 sq ft');
    expect(formatArea(10, 'imperial')).toBe('108 sq ft');
    expect(formatArea(4046.86, 'imperial')).toBe('1.00 acres');
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
  it('names a run by the hour it started: 4 to 10 is Morning', () => {
    expect(getActivityName('run', 4)).toBe('Morning Run');
    expect(getActivityName('run', 8)).toBe('Morning Run');
    expect(getActivityName('run', 10)).toBe('Morning Run');
  });

  it('has a Lunch slot at 11 and 12', () => {
    expect(getActivityName('run', 11)).toBe('Lunch Run');
    expect(getActivityName('walk', 12)).toBe('Lunch Walk');
  });

  it('calls 13 to 17 Afternoon', () => {
    expect(getActivityName('ride', 13)).toBe('Afternoon Ride');
    expect(getActivityName('ride', 17)).toBe('Afternoon Ride');
  });

  it('calls 18 to 20 Evening', () => {
    expect(getActivityName('walk', 18)).toBe('Evening Walk');
    expect(getActivityName('walk', 20)).toBe('Evening Walk');
  });

  it('calls 21 to 3 Night', () => {
    expect(getActivityName('run', 21)).toBe('Night Run');
    expect(getActivityName('run', 23)).toBe('Night Run');
    expect(getActivityName('run', 0)).toBe('Night Run');
    expect(getActivityName('run', 3)).toBe('Night Run');
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

  it('keeps counting days for a month, so an old notification still says how old it is', () => {
    expect(formatRelativeTime(new Date(Date.now() - 10 * 86400_000))).toBe('10d ago');
    expect(formatRelativeTime(new Date(Date.now() - 29 * 86400_000))).toBe('29d ago');
  });

  it('falls back to the date once a month has passed', () => {
    const d = new Date(Date.now() - 45 * 86400_000);
    expect(formatRelativeTime(d)).toBe(formatDay(d));
  });
});

describe('formatMemberCount', () => {
  it('shows small counts whole and thousands as k', () => {
    expect(formatMemberCount(999)).toBe('999');
    expect(formatMemberCount(1500)).toBe('1.5k');
  });
});

describe('paceLabel', () => {
  it('names the unit the pace is shown in', () => {
    expect(paceLabel()).toBe('Pace /km');
    expect(paceLabel('imperial')).toBe('Pace /mi');
  });
});

describe('toPolyline', () => {
  it('round-trips with parsePolyline', () => {
    const route: [number, number][] = [
      [73.8567, 18.5204],
      [73.857, 18.521],
    ];
    expect(parsePolyline(toPolyline(route))).toEqual(route);
  });
});

describe('formatElevation', () => {
  it('shows metres or feet by the unit setting', () => {
    expect(formatElevation(120.4)).toBe('120m');
    expect(formatElevation(100, 'imperial')).toBe('328ft');
  });
});

describe('getWeeklyStats', () => {
  const run = (iso: string) =>
    ({ distance: 5000, duration: 1_800_000, createdAt: new Date(iso) }) as never;
  const now = new Date(2026, 9, 21, 9); // Wednesday 21 Oct 2026

  it('counts days from Sunday by default', () => {
    const stats = getWeeklyStats([run('2026-10-18T07:00:00'), run('2026-10-21T07:00:00')], 0, now);
    expect(stats.activityCount).toBe(2);
    expect(stats.dailyActivityCount).toEqual([1, 0, 0, 1, 0, 0, 0]);
  });

  it('counts days from Monday, leaving last Sunday out of this week', () => {
    const stats = getWeeklyStats([run('2026-10-18T07:00:00'), run('2026-10-21T07:00:00')], 1, now);
    expect(stats.activityCount).toBe(1);
    expect(stats.dailyActivityCount).toEqual([0, 0, 1, 0, 0, 0, 0]);
  });
});

describe('bad stored values', () => {
  it('never print NaN or a negative figure', () => {
    expect(formatDistance(Number.NaN)).toBe('0m');
    expect(formatDistance(-5)).toBe('0m');
    expect(formatDuration(Number.NaN)).toBe('0s');
    expect(formatDuration(-1000)).toBe('0s');
    expect(formatPace(-100, 600_000)).toBe('--:--');
    expect(formatPace(1000, Number.NaN)).toBe('--:--');
    expect(formatPace(1000, Number.POSITIVE_INFINITY)).toBe('--:--');
  });
});

describe('activityTitle', () => {
  it('keeps the name the athlete gave', () => {
    expect(
      activityTitle({
        name: 'River loop',
        activityType: 'run',
        createdAt: new Date(2026, 10, 5, 22),
      })
    ).toBe('River loop');
  });

  it("falls back to the default title when another athlete's name is not loaded or is blank", () => {
    const createdAt = new Date(2026, 10, 5, 22, 10);
    expect(activityTitle({ name: undefined, activityType: 'run', createdAt })).toBe('Night Run');
    expect(activityTitle({ name: '  ', activityType: 'ride', createdAt })).toBe('Night Ride');
  });
});
