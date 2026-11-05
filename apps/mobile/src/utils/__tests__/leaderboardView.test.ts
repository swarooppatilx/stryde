import { describe, expect, it } from 'vitest';
import {
  boardPeriodStart,
  countableActivities,
  leaderboardView,
  periodBoardError,
  rankSummary,
} from '@/utils/leaderboardView';

const row = { wallet: '0x1' };

describe('leaderboardView', () => {
  it('shows loading until the first answer', () => {
    expect(leaderboardView({ rows: null, error: null })).toEqual({ kind: 'loading' });
  });

  it('shows the list when there are rows and no error', () => {
    expect(leaderboardView({ rows: [row], error: null })).toEqual({ kind: 'list', banner: null });
  });

  it('keeps the last rows on screen with a banner when a refresh fails', () => {
    expect(leaderboardView({ rows: [row], error: 'offline' })).toEqual({
      kind: 'list',
      banner: 'offline',
    });
  });

  it('only replaces the screen with the error when there is nothing to show', () => {
    expect(leaderboardView({ rows: [], error: 'offline' })).toEqual({
      kind: 'error',
      message: 'offline',
    });
  });

  it('shows the empty state for a successful empty season', () => {
    expect(leaderboardView({ rows: [], error: null })).toEqual({ kind: 'empty' });
  });
});

describe('rankSummary', () => {
  const rows = [{ wallet: '0xAA' }, { wallet: '0xbb' }, { wallet: '0xcc' }];

  it('says where the athlete stands, ignoring address case', () => {
    expect(rankSummary(rows, '0xBB')).toBe('You are 2nd of 3');
    expect(rankSummary(rows, '0xaa')).toBe('You are 1st of 3');
    expect(rankSummary(rows, '0xCC')).toBe('You are 3rd of 3');
  });

  it('says nothing when the athlete is not on the board', () => {
    expect(rankSummary(rows, '0xdd')).toBeNull();
    expect(rankSummary([], '0xaa')).toBeNull();
  });

  it('gets the odd ordinals right', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ wallet: `0x${i}` }));
    expect(rankSummary(many, '0x10')).toBe('You are 11th of 25');
    expect(rankSummary(many, '0x11')).toBe('You are 12th of 25');
    expect(rankSummary(many, '0x20')).toBe('You are 21st of 25');
  });
});

describe('boardPeriodStart', () => {
  // Wednesday 29 Oct 2026, mid-afternoon local time.
  const now = new Date(2026, 9, 29, 15, 42);

  it('starts the week at midnight on the Sunday before', () => {
    expect(boardPeriodStart('week', now)).toEqual(new Date(2026, 9, 25, 0, 0, 0, 0));
  });

  it('starts the week on the Monday before when weeks begin on Monday', () => {
    expect(boardPeriodStart('week', now, 1)).toEqual(new Date(2026, 9, 26));
  });

  it('starts the week today when today is Sunday', () => {
    expect(boardPeriodStart('week', new Date(2026, 9, 25, 9))).toEqual(new Date(2026, 9, 25));
  });

  it('starts the month at midnight on the 1st', () => {
    expect(boardPeriodStart('month', now)).toEqual(new Date(2026, 9, 1));
  });
});

describe('countableActivities', () => {
  const act = (userId: string, extra: Record<string, unknown> = {}) =>
    ({ id: userId, userId, kudos: [], comments: [], ...extra }) as never;
  const me = '0xme';

  it("keeps public activities and the viewer's own, drops Only Me from others and mocked runs", () => {
    const list = [
      act('0xa'),
      act('0xb', { privacy: 'only_me' }),
      act('0xme', { privacy: 'only_me' }),
      act('0xc', { mocked: true }),
    ];

    expect(countableActivities(list, me, new Set()).map((a) => a.userId)).toEqual(['0xa', '0xme']);
  });

  it('counts a followers-only activity only for someone who follows its author', () => {
    const list = [act('0xa', { privacy: 'followers' })];

    expect(countableActivities(list, me, new Set())).toHaveLength(0);
    expect(countableActivities(list, me, new Set(['0xa']))).toHaveLength(1);
  });
});

describe('periodBoardError', () => {
  it('says nothing when the load worked', () => {
    expect(periodBoardError(false, 0, 0)).toBeNull();
  });

  it('reports a failure when there is nothing cached to count', () => {
    expect(periodBoardError(true, 0, 0)).toMatch(/Could not load/);
  });

  it('reports a failure over a board that is on screen, since it may be stale', () => {
    expect(periodBoardError(true, 12, 3)).toMatch(/Could not load/);
  });

  it('lets an empty window stand when activities are cached', () => {
    expect(periodBoardError(true, 12, 0)).toBeNull();
  });
});
