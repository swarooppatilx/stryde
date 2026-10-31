import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { useNotificationPrefsStore, NOTIFICATION_KINDS, isEnabled, sanitizePrefs, enabledCount } =
  await import('@/stores/notificationPrefsStore');

beforeEach(() => {
  installFakePlatform();
  useNotificationPrefsStore.getState().reset();
});

describe('notification preferences', () => {
  it('lists the thirteen kinds, each once', () => {
    const kinds = NOTIFICATION_KINDS.map((k) => k.kind);
    expect(new Set(kinds).size).toBe(13);
    expect(kinds).toContain('streakAtRisk');
    expect(kinds).toContain('recordingNotice');
    expect(kinds).toContain('uploadFailure');
    expect(kinds).not.toContain('marketing');
  });

  it('starts with every kind on', () => {
    for (const { kind } of NOTIFICATION_KINDS) expect(isEnabled(kind), kind).toBe(true);
    expect(enabledCount(useNotificationPrefsStore.getState().prefs)).toBe(13);
  });

  it('turns one kind off and back on without touching the others', () => {
    useNotificationPrefsStore.getState().setEnabled('kudos', false);

    expect(isEnabled('kudos')).toBe(false);
    expect(isEnabled('comments')).toBe(true);
    expect(enabledCount(useNotificationPrefsStore.getState().prefs)).toBe(12);

    useNotificationPrefsStore.getState().setEnabled('kudos', true);
    expect(isEnabled('kudos')).toBe(true);
  });

  it('reads from the prefs it is given', () => {
    const prefs = { ...useNotificationPrefsStore.getState().prefs, goalReached: false };
    expect(isEnabled('goalReached', prefs)).toBe(false);
    expect(isEnabled('goalReached')).toBe(true);
  });

  it('reset turns everything back on', () => {
    useNotificationPrefsStore.getState().setEnabled('newFollower', false);
    useNotificationPrefsStore.getState().reset();
    expect(isEnabled('newFollower')).toBe(true);
  });

  it('sanitizes stored data: unknown keys dropped, missing or invalid ones default on', () => {
    const prefs = sanitizePrefs({ kudos: false, comments: 'no', marketing: true });

    expect(prefs.kudos).toBe(false);
    expect(prefs.comments).toBe(true);
    expect('marketing' in prefs).toBe(false);
    expect(Object.keys(prefs)).toHaveLength(13);
    expect(Object.keys(sanitizePrefs(undefined))).toHaveLength(13);
    expect(Object.keys(sanitizePrefs(7))).toHaveLength(13);
  });

  it('persists at version 1', () => {
    expect(useNotificationPrefsStore.persist.getOptions().version).toBe(1);
  });
});
