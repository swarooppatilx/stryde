import { describe, expect, it } from 'vitest';
import { defaultGroupTab, GROUP_TABS } from '@/utils/groupTabs';

describe('group tabs', () => {
  it('lists the tabs in order: Challenges, Clubs, Events', () => {
    expect([...GROUP_TABS]).toEqual(['Challenges', 'Clubs', 'Events']);
  });

  it('opens on Clubs for an athlete with no activities yet', () => {
    expect(defaultGroupTab({ hasActivities: false })).toBe('Clubs');
  });

  it('opens on Challenges once the athlete has uploaded something', () => {
    expect(defaultGroupTab({ hasActivities: true })).toBe('Challenges');
  });
});
