import { describe, expect, it } from 'vitest';
import { followButtonLabel, followsViewer } from '@/utils/followRelation';

describe('followButtonLabel', () => {
  it('offers to follow someone you do not follow', () => {
    expect(followButtonLabel({ isFollowing: false, followsViewer: false })).toBe('Follow');
  });

  it('offers to follow back someone who follows you', () => {
    expect(followButtonLabel({ isFollowing: false, followsViewer: true })).toBe('Follow back');
  });

  it('says Following once you do, whoever started it', () => {
    expect(followButtonLabel({ isFollowing: true, followsViewer: false })).toBe('Following');
    expect(followButtonLabel({ isFollowing: true, followsViewer: true })).toBe('Following');
  });
});

describe('followsViewer', () => {
  const entries = [{ address: '0xAbC', followedAt: 1 }];

  it('finds an athlete among the viewer’s followers, whatever the letter case', () => {
    expect(followsViewer('0xabc', entries)).toBe(true);
    expect(followsViewer('0xABC', entries)).toBe(true);
  });

  it('is false for anyone else, and for an empty list', () => {
    expect(followsViewer('0xdef', entries)).toBe(false);
    expect(followsViewer('0xabc', [])).toBe(false);
  });
});
