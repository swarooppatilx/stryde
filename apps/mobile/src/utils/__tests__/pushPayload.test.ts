import { describe, expect, it } from 'vitest';
import { NOTIFICATION_KINDS, sanitizePrefs } from '@/stores/notificationPrefsStore';
import { parsePushPayload, routeForPush, shouldShowPush } from '../pushPayload';

const allOn = sanitizePrefs({});

describe('parsePushPayload', () => {
  it('reads a known kind and its id', () => {
    expect(parsePushPayload({ kind: 'kudos', id: 'a1' })).toEqual({ kind: 'kudos', id: 'a1' });
  });

  it.each([null, undefined, 'x', 3, {}, { kind: 'nonsense' }, { kind: 7 }])(
    'returns null for %j',
    (data) => {
      expect(parsePushPayload(data)).toBeNull();
    }
  );

  it('drops an id that is not text', () => {
    expect(parsePushPayload({ kind: 'kudos', id: 4 })).toEqual({ kind: 'kudos' });
  });

  it('accepts only kinds the settings screen knows', () => {
    for (const { kind } of NOTIFICATION_KINDS) {
      expect(parsePushPayload({ kind })?.kind).toBe(kind);
    }
  });
});

describe('routeForPush', () => {
  it.each([
    ['kudos', '/activities/[id]'],
    ['comments', '/activities/[id]'],
    ['mentions', '/activities/[id]'],
    ['friendActivities', '/activities/[id]'],
    ['newFollower', '/athletes/[id]'],
    ['clubUpdates', '/clubs/[id]'],
    ['challenges', '/challenges/[id]'],
  ] as const)('sends %s to %s with its id', (kind, pathname) => {
    expect(routeForPush({ kind, id: 'x1' })).toEqual({ pathname, params: { id: 'x1' } });
  });

  it('opens the segment screen by key for a segment record', () => {
    expect(routeForPush({ kind: 'segments', id: '0xabc' })).toEqual({
      pathname: '/segment-detail',
      params: { key: '0xabc' },
    });
  });

  it('has no screen to open without an id for a screen that needs one', () => {
    expect(routeForPush({ kind: 'kudos' })).toBeNull();
  });

  it('has no screen for kinds that are only a summary', () => {
    expect(routeForPush({ kind: 'weeklySummary' })).toBeNull();
  });
});

describe('shouldShowPush', () => {
  it('shows a kind the athlete left on', () => {
    expect(shouldShowPush({ kind: 'kudos' }, allOn)).toBe(true);
  });

  it('hides a kind the athlete turned off', () => {
    expect(shouldShowPush({ kind: 'kudos' }, { ...allOn, kudos: false })).toBe(false);
  });

  it('shows what it cannot classify, since nothing says it is unwanted', () => {
    expect(shouldShowPush({ mystery: true }, allOn)).toBe(true);
  });
});
