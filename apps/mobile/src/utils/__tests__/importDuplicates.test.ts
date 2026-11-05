import { describe, expect, it } from 'vitest';
import { isDuplicateActivity } from '@/utils/importDuplicates';

const START = Date.parse('2026-10-16T06:00:00Z');
const candidate = { startedAt: START, distance: 5000 };
const own = (createdAt: number, distance = 5000, duration = 1_800_000) => ({
  createdAt: new Date(createdAt),
  duration,
  distance,
});

describe('isDuplicateActivity', () => {
  it('matches an activity that started within a minute with a similar distance', () => {
    expect(isDuplicateActivity(candidate, [own(START + 59_000, 5100)])).toBe(true);
  });

  it('matches an older activity dated by when it ended', () => {
    expect(isDuplicateActivity(candidate, [own(START + 1_800_000)])).toBe(true);
  });

  it('does not match a different start, or a very different distance', () => {
    expect(isDuplicateActivity(candidate, [own(START + 61_000 + 1_800_000 + 60_000)])).toBe(false);
    expect(isDuplicateActivity(candidate, [own(START, 8000)])).toBe(false);
  });

  it('does not match when nothing is saved', () => {
    expect(isDuplicateActivity(candidate, [])).toBe(false);
  });
});
