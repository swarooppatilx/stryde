import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_STATUS_LABEL,
  type ChallengeFilter,
  challengeStatusColor,
  challengeTimeLeft,
  matchesChallengeFilter,
  orderChallenges,
} from '@/utils/challengeFilter';

const ME = '0xAAA0000000000000000000000000000000000001';
const THEM = '0xBBB0000000000000000000000000000000000002';
const matches = (filter: ChallengeFilter, status: number, challenger: string, opponent: string) =>
  matchesChallengeFilter({ status, challenger, opponent }, filter, ME);

describe('matchesChallengeFilter', () => {
  it('lets everything through for All', () => {
    expect(matches('all', 3, ME, THEM)).toBe(true);
  });

  it('puts a challenge sent to me and still open under Needs you', () => {
    expect(matches('needs-you', 0, THEM, ME)).toBe(true);
  });

  it('does not ask me to act on a challenge I sent myself, or one that is not open', () => {
    expect(matches('needs-you', 0, ME, THEM)).toBe(false);
    expect(matches('needs-you', 1, THEM, ME)).toBe(false);
  });

  it('treats open and accepted challenges as active, settled and cancelled as done', () => {
    expect(matches('active', 0, ME, THEM)).toBe(true);
    expect(matches('active', 1, THEM, ME)).toBe(true);
    expect(matches('active', 2, ME, THEM)).toBe(false);
    expect(matches('done', 2, ME, THEM)).toBe(true);
    expect(matches('done', 3, ME, THEM)).toBe(true);
    expect(matches('done', 1, ME, THEM)).toBe(false);
  });

  it('compares addresses whatever their casing', () => {
    expect(
      matchesChallengeFilter(
        { status: 0, challenger: THEM, opponent: ME.toLowerCase() },
        'needs-you',
        ME
      )
    ).toBe(true);
  });
});

describe('CHALLENGE_STATUS_LABEL', () => {
  it('names each status the contract can report', () => {
    expect(CHALLENGE_STATUS_LABEL).toEqual(['Open', 'Accepted', 'Settled', 'Cancelled']);
  });
});

describe('challengeStatusColor', () => {
  it('reads green once settled, muted once cancelled, and falls back to the accent', () => {
    expect(challengeStatusColor(2)).toBe('successText');
    expect(challengeStatusColor(3)).toBe('textSecondary');
    expect(challengeStatusColor(1)).toBe('warningText');
    expect(challengeStatusColor(0)).toBe('accentText');
    expect(challengeStatusColor(9)).toBe('accentText');
  });
});

describe('orderChallenges', () => {
  const c = (id: string, status: number, challenger: string, opponent: string) => ({
    id,
    status,
    challenger,
    opponent,
  });

  it('puts ones waiting on you first, then live ones, then finished ones, keeping the given order within each', () => {
    const list = [
      c('done-1', 2, ME, THEM),
      c('live-1', 1, ME, THEM),
      c('waiting-1', 0, THEM, ME),
      c('cancelled-1', 3, THEM, ME),
      c('mine-open', 0, ME, THEM),
      c('waiting-2', 0, THEM, ME),
    ];

    expect(orderChallenges(list, ME).map((x) => x.id)).toEqual([
      'waiting-1',
      'waiting-2',
      'live-1',
      'mine-open',
      'done-1',
      'cancelled-1',
    ]);
  });

  it('does not change the list it was given', () => {
    const list = [c('b', 2, ME, THEM), c('a', 0, THEM, ME)];

    orderChallenges(list, ME);

    expect(list.map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('challengeTimeLeft', () => {
  const now = new Date(2026, 9, 28, 12, 0, 0);
  const at = (days: number, hour = 12) =>
    Math.floor(new Date(2026, 9, 28 + days, hour, 0, 0).getTime() / 1000);

  it('counts calendar days to the deadline for a live challenge', () => {
    expect(challengeTimeLeft(at(3), 1, now)).toBe('3 days left');
    expect(challengeTimeLeft(at(1), 0, now)).toBe('1 day left');
    expect(challengeTimeLeft(at(0, 23), 1, now)).toBe('Ends today');
  });

  it('says when the deadline has passed while it is still open', () => {
    expect(challengeTimeLeft(at(-1), 1, now)).toBe('Deadline passed');
    expect(challengeTimeLeft(at(0, 9), 0, now)).toBe('Deadline passed');
  });

  it('says nothing about a settled or cancelled challenge, or a missing deadline', () => {
    expect(challengeTimeLeft(at(3), 2, now)).toBeNull();
    expect(challengeTimeLeft(at(3), 3, now)).toBeNull();
    expect(challengeTimeLeft(0, 1, now)).toBeNull();
  });
});
