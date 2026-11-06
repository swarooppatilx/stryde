import { describe, expect, it } from 'vitest';
import {
  challengeProgress,
  interleaveCards,
  pickChallengeCard,
  pickClubCard,
  pickSuggestedCard,
} from '@/utils/feedCards';

describe('interleaveCards', () => {
  const items = Array.from({ length: 12 }, (_, i) => `i${i}`);

  it('puts a card after every gap items, at most one at a time', () => {
    const out = interleaveCards(items, ['c1', 'c2'], 5);
    expect(out.indexOf('c1')).toBe(5);
    expect(out.indexOf('c2')).toBe(11);
    expect(out.filter((x) => x.startsWith('i'))).toEqual(items);
  });

  it('never places two cards next to each other or leads with one', () => {
    const out = interleaveCards(items, ['c1', 'c2', 'c3', 'c4'], 3);
    expect(out[0]).toBe('i0');
    for (let i = 1; i < out.length; i++) {
      expect(out[i]?.startsWith('c') && out[i - 1]?.startsWith('c')).toBe(false);
    }
  });

  it('shows nothing extra when there are no items or no cards', () => {
    expect(interleaveCards([], ['c1'], 3)).toEqual([]);
    expect(interleaveCards(['a', 'b'], ['c1'], 3)).toEqual(['a', 'b']);
    expect(interleaveCards(items, [], 3)).toEqual(items);
  });

  it('drops cards that do not fit rather than trailing them', () => {
    expect(interleaveCards(['a', 'b', 'c'], ['x'], 3)).toEqual(['a', 'b', 'c']);
  });

  it('treats a gap below one as one', () => {
    expect(interleaveCards(['a', 'b'], ['x', 'y'], 0)).toEqual(['a', 'x', 'b']);
  });
});

describe('challengeProgress', () => {
  const event = {
    startDate: new Date('2026-11-01T00:00:00Z'),
    endDate: new Date('2026-11-30T00:00:00Z'),
    distanceGoal: 100_000,
    sportType: 'run' as const,
  };
  const act = (distance: number, day: string, activityType = 'run', over = {}) => ({
    distance,
    activityType,
    createdAt: new Date(`${day}T10:00:00Z`),
    ...over,
  });

  it('adds recorded distance of the right sport inside the window', () => {
    const p = challengeProgress(event, [
      act(20_000, '2026-11-02'),
      act(5000, '2026-11-03', 'ride'),
      act(9000, '2026-10-20'),
      act(9000, '2026-11-04', 'run', { isManual: true }),
    ]);
    expect(p).toBeCloseTo(0.2, 5);
  });

  it('counts every sport for a multi-sport event and caps at 1', () => {
    const p = challengeProgress({ ...event, sportType: 'multi' as const }, [
      act(80_000, '2026-11-02'),
      act(80_000, '2026-11-03', 'ride'),
    ]);
    expect(p).toBe(1);
  });

  it('is null when the event has no distance goal', () => {
    expect(challengeProgress({ ...event, distanceGoal: 0 }, [])).toBeNull();
  });
});

describe('pickChallengeCard', () => {
  const now = new Date('2026-11-10T00:00:00Z');
  const ev = (id: string, over = {}) => ({
    id,
    title: `Event ${id}`,
    startDate: new Date('2026-11-01T00:00:00Z'),
    endDate: new Date('2026-11-30T00:00:00Z'),
    distanceGoal: 100_000,
    participantCount: 3,
    sportType: 'run' as const,
    ...over,
  });

  it('prefers a joined live challenge and reports progress', () => {
    const card = pickChallengeCard([ev('a'), ev('b')], ['b'], [], now, []);
    expect(card).toMatchObject({ kind: 'challenge', eventId: 'b', progress: 0 });
  });

  it('invites to the busiest live challenge when none is joined', () => {
    const card = pickChallengeCard([ev('a'), ev('b', { participantCount: 9 })], [], [], now, []);
    expect(card).toMatchObject({ eventId: 'b', progress: null });
  });

  it('skips ended, upcoming and dismissed ones', () => {
    const ended = ev('e', { endDate: new Date('2026-11-05T00:00:00Z') });
    const upcoming = ev('u', { startDate: new Date('2026-12-01T00:00:00Z') });
    expect(pickChallengeCard([ended, upcoming], [], [], now, [])).toBeNull();
    expect(pickChallengeCard([ev('a')], [], [], now, ['challenge:a'])).toBeNull();
  });
});

describe('pickClubCard', () => {
  const clubs = [
    { id: '1', name: 'Dawn Patrol' },
    { id: '2', name: 'Hill Reps' },
  ];
  const post = (id: string, createdAt: number, text = 'hello') => ({ id, createdAt, text });

  it('shows the newest post across joined clubs', () => {
    const card = pickClubCard(
      clubs,
      ['1', '2'],
      { '1': [post('p1', 100)], '2': [post('p2', 200, 'Saturday long run')] },
      []
    );
    expect(card).toMatchObject({
      kind: 'club',
      clubId: '2',
      clubName: 'Hill Reps',
      text: 'Saturday long run',
    });
  });

  it('ignores clubs not joined, empty posts and dismissed ones', () => {
    expect(pickClubCard(clubs, [], { '1': [post('p1', 1)] }, [])).toBeNull();
    expect(pickClubCard(clubs, ['1'], { '1': [post('p1', 1, '  ')] }, [])).toBeNull();
    expect(pickClubCard(clubs, ['1'], { '1': [post('p1', 1)] }, ['club:1:p1'])).toBeNull();
  });
});

describe('pickSuggestedCard', () => {
  const user = (id: string, followers: number) => ({ id, username: id, followers }) as never;
  const users = { a: user('a', 5), b: user('b', 9), c: user('c', 1), me: user('me', 99) };

  it('lists up to three athletes not yet followed, most followed first', () => {
    const card = pickSuggestedCard(users, new Set(['c']), 'me', [], []);
    expect(card?.people.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('needs at least two people and respects a dismissal', () => {
    expect(pickSuggestedCard(users, new Set(['a', 'c']), 'me', [], [])).toBeNull();
    expect(pickSuggestedCard(users, new Set(), 'me', [], ['suggested'])).toBeNull();
  });

  it('leaves out hidden athletes', () => {
    const card = pickSuggestedCard(users, new Set(), 'me', ['b'], []);
    expect(card?.people.map((p) => p.id)).toEqual(['a', 'c']);
  });
});
