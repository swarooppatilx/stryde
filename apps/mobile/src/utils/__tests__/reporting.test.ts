import { describe, expect, it } from 'vitest';
import { BANNED_USER_WORDS } from '@/constants/copy';
import {
  canReport,
  MAX_REPORT_NOTE_LENGTH,
  NOTHING_REPORTED,
  REPORT_REASONS,
  reportKey,
  reportNoteProblem,
  withoutReportedIds,
  withReportedHidden,
} from '@/utils/reporting';

const ME = '0xAAA0000000000000000000000000000000000001';
const THEM = '0xbbb0000000000000000000000000000000000002';

describe('REPORT_REASONS', () => {
  it('offers the five reasons the server knows, in order', () => {
    expect(REPORT_REASONS.map((r) => r.value)).toEqual([
      'spam',
      'abusive',
      'inappropriate',
      'impersonation',
      'other',
    ]);
  });

  it('uses plain words', () => {
    for (const { label } of REPORT_REASONS) {
      expect(label.trim().length).toBeGreaterThan(3);
      expect(label).not.toMatch(BANNED_USER_WORDS);
    }
  });
});

describe('canReport', () => {
  it('lets you report someone else’s athlete, activity or comment', () => {
    for (const kind of ['user', 'activity', 'comment'] as const) {
      expect(canReport({ kind, id: 'x', ownerId: THEM }, ME)).toBe(true);
    }
  });

  it('does not offer reporting yourself or your own content, whatever the letter case', () => {
    expect(canReport({ kind: 'user', id: ME, ownerId: ME }, ME.toLowerCase())).toBe(false);
    expect(canReport({ kind: 'comment', id: 'c', ownerId: ME.toLowerCase() }, ME)).toBe(false);
  });

  it('does not offer it when the owner is unknown', () => {
    expect(canReport({ kind: 'activity', id: 'a', ownerId: '' }, ME)).toBe(false);
  });
});

describe('reportKey', () => {
  it('files the same target under the same key, whatever the id’s letter case', () => {
    expect(reportKey({ kind: 'user', id: '0xAB' })).toBe(reportKey({ kind: 'user', id: '0xab' }));
  });

  it('keeps kinds apart', () => {
    expect(reportKey({ kind: 'activity', id: '1' })).not.toBe(
      reportKey({ kind: 'comment', id: '1' })
    );
  });
});

describe('withReportedHidden', () => {
  it('adds an activity or a comment to its own list', () => {
    const afterActivity = withReportedHidden(NOTHING_REPORTED, {
      kind: 'activity',
      id: 'a1',
      ownerId: THEM,
    });
    const afterBoth = withReportedHidden(afterActivity, {
      kind: 'comment',
      id: 'c1',
      ownerId: THEM,
    });

    expect(afterBoth).toEqual({ activities: ['a1'], comments: ['c1'] });
  });

  it('lists a target once', () => {
    const target = { kind: 'comment', id: 'c1', ownerId: THEM } as const;

    expect(
      withReportedHidden(withReportedHidden(NOTHING_REPORTED, target), target).comments
    ).toEqual(['c1']);
  });

  it('leaves a reported athlete to the mute list', () => {
    expect(withReportedHidden(NOTHING_REPORTED, { kind: 'user', id: THEM, ownerId: THEM })).toBe(
      NOTHING_REPORTED
    );
  });

  it('does not change the list it was given', () => {
    const before = { activities: ['a1'], comments: [] };
    withReportedHidden(before, { kind: 'activity', id: 'a2', ownerId: THEM });

    expect(before.activities).toEqual(['a1']);
  });
});

describe('withoutReportedIds', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('drops the reported ones and keeps the order of the rest', () => {
    expect(withoutReportedIds(items, (i) => i.id, ['b'])).toEqual([{ id: 'a' }, { id: 'c' }]);
  });

  it('returns the same list when nothing was reported', () => {
    expect(withoutReportedIds(items, (i) => i.id, [])).toBe(items);
  });
});

describe('reportNoteProblem', () => {
  it('accepts no note, a short note, and one at the limit', () => {
    expect(reportNoteProblem('')).toBeNull();
    expect(reportNoteProblem('  keeps sending ads  ')).toBeNull();
    expect(reportNoteProblem('x'.repeat(MAX_REPORT_NOTE_LENGTH))).toBeNull();
  });

  it('refuses a note that is too long', () => {
    expect(reportNoteProblem('x'.repeat(MAX_REPORT_NOTE_LENGTH + 1))).not.toBeNull();
  });

  it('refuses control characters, line breaks included', () => {
    expect(reportNoteProblem('one\ntwo')).not.toBeNull();
    expect(reportNoteProblem('bell\u0007')).not.toBeNull();
  });
});
