import { describe, expect, it } from 'vitest';
import { checklistVisible, deriveChecklist, nextChecklistItem } from '@/utils/gettingStarted';

const none = { activityCount: 0, goalSet: false, followingCount: 0, hasPhoto: false };

describe('deriveChecklist', () => {
  it('lists the four rows in order, all open for a new account', () => {
    const items = deriveChecklist(none);
    expect(items.map((i) => i.id)).toEqual(['activity', 'goal', 'follow', 'photo']);
    expect(items.every((i) => !i.done)).toBe(true);
  });
  it('ticks each row from real data', () => {
    const items = deriveChecklist({
      activityCount: 2,
      goalSet: true,
      followingCount: 1,
      hasPhoto: false,
    });
    expect(items.map((i) => i.done)).toEqual([true, true, true, false]);
  });
});

describe('checklistVisible', () => {
  it('shows while something is open', () => {
    expect(checklistVisible(deriveChecklist(none), false)).toBe(true);
  });
  it('hides when dismissed or complete', () => {
    expect(checklistVisible(deriveChecklist(none), true)).toBe(false);
    const all = deriveChecklist({
      activityCount: 1,
      goalSet: true,
      followingCount: 1,
      hasPhoto: true,
    });
    expect(checklistVisible(all, false)).toBe(false);
  });
});

describe('nextChecklistItem', () => {
  it('returns the first open step in checklist order', () => {
    const items = deriveChecklist({ ...none, activityCount: 2, goalSet: false, hasPhoto: true });
    expect(nextChecklistItem(items)?.id).toBe('goal');
  });
  it('returns null once every step is done', () => {
    const all = deriveChecklist({
      activityCount: 1,
      goalSet: true,
      followingCount: 1,
      hasPhoto: true,
    });
    expect(nextChecklistItem(all)).toBeNull();
  });
});
