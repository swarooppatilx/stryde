import { describe, expect, it } from 'vitest';
import { BANNED_USER_WORDS } from '@/constants/copy';
import { BADGE_COPY, badgeShareMessage, badgeState } from '@/utils/badgeState';

describe('badgeState', () => {
  it('is locked until the badge is earned, whatever the read says', () => {
    expect(badgeState({ unlocked: false, read: 'minted' })).toBe('locked');
    expect(badgeState({ unlocked: false, read: 'failed' })).toBe('locked');
  });

  it('makes no claim while the read is loading', () => {
    expect(badgeState({ unlocked: true, read: 'loading' })).toBe('checking');
  });

  it('says it could not check when the read failed', () => {
    expect(badgeState({ unlocked: true, read: 'failed' })).toBe('unavailable');
  });

  it('is minted once a read says so', () => {
    expect(badgeState({ unlocked: true, read: 'minted' })).toBe('minted');
  });

  it('is only "not saved yet" when a read succeeded and found nothing', () => {
    expect(badgeState({ unlocked: true, read: 'notMinted' })).toBe('notSaved');
  });
});

describe('copy', () => {
  it('never promises a save is under way', () => {
    expect(BADGE_COPY.notSaved.title).toBe('Not saved to the chain yet');
    for (const copy of Object.values(BADGE_COPY)) {
      expect(`${copy.title} ${copy.body}`).not.toMatch(/on its way|Saving to the chain/i);
    }
  });

  it('offers a retry only where a retry makes sense', () => {
    expect(BADGE_COPY.unavailable.title).toBe('We could not check this badge right now');
  });

  it('keeps plumbing words out of every line', () => {
    for (const copy of Object.values(BADGE_COPY)) {
      expect(`${copy.title} ${copy.body}`).not.toMatch(BANNED_USER_WORDS);
    }
    expect(badgeShareMessage('5K Runner')).not.toMatch(BANNED_USER_WORDS);
  });

  it('names the badge in the share message', () => {
    expect(badgeShareMessage('5K Runner')).toContain('5K Runner');
  });
});
