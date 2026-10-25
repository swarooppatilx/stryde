import { describe, expect, it } from 'vitest';
import type { Activity } from '@/types';
import { loggedThisWeek, weeklyStreak } from '@/utils/weeklyStreak';

const at = (iso: string) => ({ createdAt: new Date(iso) }) as Activity;

// Wednesday 2024-05-15, local time.
const NOW = new Date(2024, 4, 15, 12);
const day = (month: number, d: number) => at(new Date(2024, month - 1, d, 9).toISOString());

describe('weeklyStreak', () => {
  it('is zero with no activities', () => {
    expect(weeklyStreak([], NOW, 0)).toBe(0);
  });

  it('counts consecutive weeks that each have an activity', () => {
    // Sunday-start weeks: May 12-18 (now), May 5-11, Apr 28-May 4.
    expect(weeklyStreak([day(5, 14), day(5, 7), day(4, 30)], NOW, 0)).toBe(3);
  });

  it('counts a week once however many activities it holds', () => {
    expect(weeklyStreak([day(5, 13), day(5, 14), day(5, 15)], NOW, 0)).toBe(1);
  });

  it('does not break the streak while the current week is still empty', () => {
    expect(weeklyStreak([day(5, 8), day(5, 1)], NOW, 0)).toBe(2);
  });

  it('stops at a gap week', () => {
    // Nothing in May 5-11, so only this week counts.
    expect(weeklyStreak([day(5, 14), day(4, 30)], NOW, 0)).toBe(1);
  });

  it('is zero once a whole finished week has passed with nothing', () => {
    expect(weeklyStreak([day(5, 1)], NOW, 0)).toBe(0);
  });

  it('follows the chosen first day of the week', () => {
    // Sunday May 12 belongs to the week of May 5-11 when weeks start Monday, and to this week when they start Sunday.
    const sunday = [day(5, 12), day(5, 7)];
    expect(weeklyStreak(sunday, NOW, 0)).toBe(2);
    expect(weeklyStreak(sunday, NOW, 1)).toBe(1);
  });

  it('ignores activities after now', () => {
    expect(weeklyStreak([day(5, 25)], NOW, 0)).toBe(0);
  });
});

describe('loggedThisWeek', () => {
  it('is true only when the current week has an activity', () => {
    expect(loggedThisWeek([day(5, 13)], NOW, 0)).toBe(true);
    expect(loggedThisWeek([day(5, 11)], NOW, 0)).toBe(false);
    expect(loggedThisWeek([day(5, 12)], NOW, 1)).toBe(false);
  });
});
