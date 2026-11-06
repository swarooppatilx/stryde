import { describe, expect, it } from 'vitest';
import { weeklyLeaderboard, weeklyTotals, weekStart } from '@/utils/clubWeekly';

// Wednesday 5 Nov 2026, midday local time.
const NOW = new Date(2026, 10, 5, 12).getTime();
const DAY = 86_400_000;

describe('weekStart', () => {
  it('is Monday midnight', () => {
    expect(new Date(weekStart(NOW)).getDay()).toBe(1);
    expect(new Date(weekStart(NOW)).getHours()).toBe(0);
  });
});

describe('weeklyLeaderboard', () => {
  const acts = [
    { athlete: '0xA', distance: 5000, duration: 1_800_000, at: NOW - DAY },
    { athlete: '0xa', distance: 3000, duration: 1_000_000, at: NOW },
    { athlete: '0xB', distance: 10000, duration: 3_600_000, at: NOW - DAY },
    { athlete: '0xC', distance: 99000, duration: 1, at: NOW - DAY },
    { athlete: '0xB', distance: 7000, duration: 1, at: NOW - 8 * DAY },
  ];

  it('ranks members by this week, ignoring non-members and other weeks', () => {
    const rows = weeklyLeaderboard(acts, ['0xa', '0xb'], 'distance', NOW);
    expect(rows.map((r) => [r.athlete, r.distance, r.activities, r.rank])).toEqual([
      ['0xb', 10000, 1, 1],
      ['0xa', 8000, 2, 2],
    ]);
    expect(weeklyLeaderboard(acts, ['0xa', '0xb'], 'activities', NOW)[0]?.athlete).toBe('0xa');
    expect(weeklyTotals(rows)).toEqual({
      distance: 18000,
      duration: 6_400_000,
      activities: 3,
      athletes: 2,
    });
  });

  it('can show last week', () => {
    expect(weeklyLeaderboard(acts, ['0xb'], 'distance', NOW, 1)[0]?.distance).toBe(7000);
  });
});
