import { describe, expect, it } from 'vitest';
import { clubRowSubtitle, memberNoun } from '@/utils/clubRow';

describe('memberNoun', () => {
  it('names members after the club sport, singular for one', () => {
    expect(memberNoun('run', 1)).toBe('runner');
    expect(memberNoun('run', 12)).toBe('runners');
    expect(memberNoun('ride', 2)).toBe('cyclists');
    expect(memberNoun('hike', 0)).toBe('hikers');
  });

  it('falls back to "members" for mixed or unmapped sports', () => {
    expect(memberNoun('multi', 5)).toBe('members');
    expect(memberNoun('multi', 1)).toBe('member');
    expect(memberNoun('hiit', 3)).toBe('members');
  });
});

describe('clubRowSubtitle', () => {
  it('joins count and place with a bullet', () => {
    expect(clubRowSubtitle({ sportType: 'run', memberCount: 1200, location: 'Pune' })).toBe(
      '1.2k runners • Pune'
    );
  });

  it('drops the place when the club has none', () => {
    expect(clubRowSubtitle({ sportType: 'ride', memberCount: 1, location: '' })).toBe('1 cyclist');
  });
});
