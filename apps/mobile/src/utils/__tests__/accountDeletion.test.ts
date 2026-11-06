import { describe, expect, it } from 'vitest';
import { BANNED_USER_WORDS } from '@/constants/copy';
import {
  DELETE_CONFIRM_WORD,
  deletionCopy,
  isDeleteConfirmed,
  removedSummary,
} from '@/utils/accountDeletion';

const none = {
  follows: 0,
  posts: 0,
  about: 0,
  commentLikes: 0,
  reports: 0,
  pushTokens: 0,
  beacons: 0,
};

describe('isDeleteConfirmed', () => {
  it('accepts the word in any case with stray spaces', () => {
    expect(isDeleteConfirmed(` ${DELETE_CONFIRM_WORD.toLowerCase()} `)).toBe(true);
    expect(isDeleteConfirmed(DELETE_CONFIRM_WORD)).toBe(true);
  });

  it('refuses anything else', () => {
    for (const text of ['', 'delet', 'delete my account', 'yes']) {
      expect(isDeleteConfirmed(text)).toBe(false);
    }
  });
});

describe('removedSummary', () => {
  it('lists only what was removed, with the right plurals', () => {
    expect(removedSummary({ ...none, follows: 3, posts: 1, pushTokens: 1 })).toBe(
      '3 follows, 1 post and 1 notification device removed from the server.'
    );
  });

  it('says plainly when the server held nothing', () => {
    expect(removedSummary(none)).toBe('The server held no records for your account.');
  });
});

describe('deletionCopy', () => {
  it('says what stays public and avoids the words the app does not use', () => {
    for (const text of Object.values(deletionCopy)) expect(text).not.toMatch(BANNED_USER_WORDS);
    expect(deletionCopy.permanent).toMatch(/cannot be erased/);
  });
});
