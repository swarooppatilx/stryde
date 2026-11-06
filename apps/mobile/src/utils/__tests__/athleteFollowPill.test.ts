import { describe, expect, it } from 'vitest';
import { athleteFollowPill, showsAthleteRow } from '@/utils/athleteFollowPill';

describe('showsAthleteRow', () => {
  it('shows another athlete on their activity', () => {
    expect(showsAthleteRow({ isOwner: false })).toBe(true);
  });

  it('hides the row on your own activity', () => {
    expect(showsAthleteRow({ isOwner: true })).toBe(false);
  });
});

describe('athleteFollowPill', () => {
  it('offers Follow to someone you do not follow yet', () => {
    expect(athleteFollowPill({ isOwner: false, isFollowing: false })).toBe('follow');
  });

  it('shows Following once you do', () => {
    expect(athleteFollowPill({ isOwner: false, isFollowing: true })).toBe('following');
  });

  it('is never shown on your own activity', () => {
    expect(athleteFollowPill({ isOwner: true, isFollowing: false })).toBeNull();
  });
});
