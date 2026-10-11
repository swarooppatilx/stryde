import { describe, expect, it } from 'vitest';
import { BANNED_USER_WORDS, PRIVACY_COPY } from '@/constants/copy';
import {
  privacyOptionDescription,
  routeHiddenNote,
  savePrivacyCaption,
} from '@/utils/privacyNotes';

describe('privacyOptionDescription', () => {
  it('is honest that Followers is published like Everyone', () => {
    const text = privacyOptionDescription('followers');
    expect(text).toMatch(/followers/i);
    expect(text).toMatch(/public/);
    expect(text).not.toMatch(/only followers/i);
  });

  it('keeps Only Me on the phone and Everyone open', () => {
    expect(privacyOptionDescription('only_me')).toContain('on this phone');
    expect(privacyOptionDescription('everyone')).toMatch(/anyone/i);
  });
});

describe('savePrivacyCaption', () => {
  it('says what stays on the phone for a recorded, shared activity', () => {
    for (const privacy of ['everyone', 'followers'] as const) {
      expect(savePrivacyCaption({ recorded: true, privacy })).toBe(PRIVACY_COPY.recordedDetails);
    }
  });

  it('says nothing for Only Me, which keeps its details on the phone already', () => {
    expect(savePrivacyCaption({ recorded: true, privacy: 'only_me' })).toBeUndefined();
  });

  it('says nothing for a manual entry, which has no heart rate, splits or laps', () => {
    expect(savePrivacyCaption({ recorded: false, privacy: 'everyone' })).toBeUndefined();
  });
});

describe('routeHiddenNote', () => {
  it('tells the owner the route is hidden from others', () => {
    expect(routeHiddenNote({ isOwner: true, hideRoute: true })).toBe(PRIVACY_COPY.routeHidden);
  });

  it('stays quiet when the route is shared, or for anyone else', () => {
    expect(routeHiddenNote({ isOwner: true, hideRoute: false })).toBeUndefined();
    expect(routeHiddenNote({ isOwner: true, hideRoute: undefined })).toBeUndefined();
    expect(routeHiddenNote({ isOwner: false, hideRoute: true })).toBeUndefined();
  });
});

describe('PRIVACY_COPY', () => {
  it('names exactly what stays on the phone and what is public', () => {
    expect(PRIVACY_COPY.recordedDetails).toBe(
      'Heart rate, splits and laps stay on this phone. Distance and time are public.'
    );
  });

  it('never leaks the plumbing', () => {
    for (const text of Object.values(PRIVACY_COPY)) expect(text).not.toMatch(BANNED_USER_WORDS);
  });
});
