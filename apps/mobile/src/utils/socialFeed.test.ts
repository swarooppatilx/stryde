import { describe, expect, it } from 'vitest';
import type { SocialActivity } from '@/stores/socialStore';
import type { Activity } from '@/types';
import {
  applyCommentLikes,
  feedFromChain,
  filterFeed,
  mergeLocalActivities,
  withCommentLike,
} from './socialFeed';

const local: Activity = {
  id: 'local-1',
  userId: 'me',
  activityType: 'run',
  distance: 1000,
  duration: 300,
  polyline: 'local-route',
  territory: null,
  territoryArea: 0,
  privacy: 'only_me',
  createdAt: new Date('2026-09-12'),
};

describe('mergeLocalActivities', () => {
  it('includes local-only activities alongside other users posts without mutating inputs', () => {
    const other: SocialActivity = {
      ...local,
      id: 'other',
      userId: 'other',
      kudos: [],
      comments: [],
    };
    const remote: Record<string, SocialActivity> = { other };
    const result = mergeLocalActivities(remote, [local]);
    expect(Object.values(result).map((a) => a.id)).toEqual(['other', 'local-1']);
    expect(result.other).toMatchObject({ id: 'other', kudos: [], comments: [] });
    expect(result['local-1']).toMatchObject({ privacy: 'only_me', kudos: [], comments: [] });
    expect(remote).toEqual({ other });
  });

  it('deduplicates chain records by hash, retaining local details and social interactions', () => {
    const remote: Record<string, SocialActivity> = {
      'hash-1': {
        ...local,
        id: 'hash-1',
        activityHash: 'hash-1',
        polyline: '',
        kudos: ['friend'],
        comments: [],
      },
    };
    const result = mergeLocalActivities(remote, [{ ...local, activityHash: 'hash-1' }]);
    expect(Object.keys(result)).toEqual(['hash-1']);
    expect(result['hash-1']).toMatchObject({
      id: 'local-1',
      polyline: 'local-route',
      kudos: ['friend'],
    });
  });

  it('keeps local-only interactions when synchronized repeatedly', () => {
    const first = mergeLocalActivities({}, [local]);
    const kept = first['local-1'];
    if (!kept) throw new Error('local-1 was not kept');
    kept.kudos = ['friend'];
    const second = mergeLocalActivities(first, [local]);
    expect(Object.keys(second)).toEqual(['local-1']);
    expect(second['local-1']?.kudos).toEqual(['friend']);
  });

  it('preserves chain activityId through merge', () => {
    const remote: Record<string, SocialActivity> = {
      'hash-1': {
        ...local,
        id: 'hash-1',
        activityHash: 'hash-1',
        activityId: '42',
        kudos: [],
        comments: [],
      },
    };
    const result = mergeLocalActivities(remote, [{ ...local, activityHash: 'hash-1' }]);
    expect(result['hash-1']?.activityId).toBe('42');
  });

  it('uses the local on-chain id when the chain copy has none yet', () => {
    const result = mergeLocalActivities({}, [{ ...local, onchainActivityId: '7' }]);
    expect(result['local-1']?.activityId).toBe('7');
  });
});

const chainActivity = (hash: string, id: bigint) => ({
  activityHash: hash,
  owner: '0xbbbb000000000000000000000000000000000002',
  activityId: id,
  activityType: 'run' as const,
  distance: 5000,
  duration: 1_800_000,
  territoryArea: 0,
  timestamp: 1_700_000_000,
  metadata: '',
});

describe('feedFromChain', () => {
  const ME = '0xaaaa000000000000000000000000000000000001';

  it('attaches kudos and comments to their activity and marks the ones I gave', () => {
    const { activities, myKudos } = feedFromChain({
      chain: [chainActivity('0xh1', 1n), chainActivity('0xh2', 2n)],
      local: [],
      existing: {},
      social: {
        kudos: [{ activityId: 1n, giver: ME.toUpperCase().replace('0X', '0x') }],
        comments: [
          {
            id: 'c1',
            activityId: 2n,
            author: '0xcc',
            cid: 'bafy',
            text: 'nice',
            createdAt: 1_700_000_100,
          },
        ],
      },
      me: ME,
    });

    expect(activities[0]?.kudos).toEqual([ME]);
    expect(activities[1]?.comments.map((c) => c.text)).toEqual(['nice']);
    expect([...myKudos]).toEqual(['0xh1']);
  });

  it('carries when each kudos was given', () => {
    const { activities } = feedFromChain({
      chain: [chainActivity('0xh1', 1n)],
      local: [],
      existing: {},
      social: {
        kudos: [{ activityId: 1n, giver: '0xAB', timestamp: 1_700_000_050 }],
        comments: [],
      },
      me: ME,
    });

    expect(activities[0]?.kudosAt).toEqual({ '0xab': 1_700_000_050 });
  });

  it('keeps my pending kudos and shows it as given', () => {
    const existing = {
      '0xh1': { ...local, id: '0xh1', activityHash: '0xh1', kudos: [ME], comments: [] },
    };

    const { activities, myKudos } = feedFromChain({
      chain: [chainActivity('0xh1', 1n)],
      local: [],
      existing,
      social: { kudos: [], comments: [] },
      me: ME,
    });

    expect(activities[0]?.kudos).toEqual([ME]);
    expect(myKudos.has('0xh1')).toBe(true);
  });

  it('keeps comments made on this device that the chain does not have yet', () => {
    const pending = { id: 'local-c', userId: ME, text: 'mine', createdAt: new Date(), likedBy: [] };
    const existing = {
      '0xh1': { ...local, id: '0xh1', activityHash: '0xh1', kudos: [], comments: [pending] },
    };

    const { activities } = feedFromChain({
      chain: [chainActivity('0xh1', 1n)],
      local: [],
      existing,
      social: { kudos: [], comments: [] },
      me: ME,
    });

    expect(activities[0]?.comments).toEqual([pending]);
  });
});

describe('filterFeed', () => {
  const post = (id: string, userId: string): SocialActivity => ({
    ...local,
    id,
    userId,
    kudos: [],
    comments: [],
  });
  const all = [post('a', 'me'), post('b', '0xfriend'), post('c', '0xstranger')];
  const following = new Set(['0xfriend']);

  it('Everyone leaves the feed as it is', () => {
    expect(filterFeed(all, 'Everyone', 'me', following)).toEqual(all);
  });

  // The Following feed includes the viewer's own activities; this used to assert the opposite.
  it('Following shows the athletes you follow and yourself, not strangers', () => {
    expect(filterFeed(all, 'Following', 'me', following).map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('You shows only your own posts, whatever case the wallet is in', () => {
    const mine = [post('a', '0xABC'), post('b', '0xdef')];

    expect(filterFeed(mine, 'You', '0xabc', new Set()).map((a) => a.id)).toEqual(['a']);
  });

  it('Following with nobody followed still shows your own posts', () => {
    expect(filterFeed(all, 'Following', 'me', new Set()).map((a) => a.id)).toEqual(['a']);
  });
});

describe('comment likes', () => {
  const COMMENT = `0x${'11'.repeat(32)}`;
  const OTHER = `0x${'22'.repeat(32)}`;
  const ME = '0xAbCdEf0000000000000000000000000000000001';
  const FRIEND = '0x00000000000000000000000000000000000000bb';
  const comment = (id: string, likedBy: string[] = []) => ({
    id,
    userId: FRIEND,
    text: 'nice',
    createdAt: new Date(),
    likedBy,
  });
  const activities = (
    comments = [comment(COMMENT), comment(OTHER)]
  ): Record<string, SocialActivity> => ({
    a1: { ...local, id: 'a1', activityHash: '0xh1', kudos: [], comments },
  });

  describe('withCommentLike', () => {
    it('adds the like to that comment only', () => {
      const next = withCommentLike(activities(), 'a1', COMMENT, ME, true);

      expect(next.a1?.comments[0]?.likedBy).toEqual([ME]);
      expect(next.a1?.comments[1]?.likedBy).toEqual([]);
    });

    it('does not add the same like twice, whatever the letter case', () => {
      const once = withCommentLike(activities(), 'a1', COMMENT, ME, true);
      const twice = withCommentLike(once, 'a1', COMMENT, ME.toLowerCase(), true);

      expect(twice.a1?.comments[0]?.likedBy).toHaveLength(1);
    });

    it('removes my like, whatever the letter case, and keeps other people’s', () => {
      const liked = activities([comment(COMMENT, [ME.toLowerCase(), FRIEND])]);

      const next = withCommentLike(liked, 'a1', COMMENT, ME, false);

      expect(next.a1?.comments[0]?.likedBy).toEqual([FRIEND]);
    });

    it('leaves everything alone for an unknown activity or comment', () => {
      const before = activities();

      expect(withCommentLike(before, 'nope', COMMENT, ME, true)).toBe(before);
      expect(withCommentLike(before, 'a1', '0xnope', ME, true).a1?.comments).toEqual(
        before.a1?.comments
      );
    });

    it('does not change the original', () => {
      const before = activities();
      withCommentLike(before, 'a1', COMMENT, ME, true);

      expect(before.a1?.comments[0]?.likedBy).toEqual([]);
    });
  });

  describe('applyCommentLikes', () => {
    it('takes the server’s list as the truth for the comments it knows', () => {
      const next = applyCommentLikes(activities([comment(COMMENT, ['stale'])]), {
        [COMMENT]: [FRIEND, ME.toLowerCase()],
      });

      expect(next.a1?.comments[0]?.likedBy).toEqual([FRIEND, ME.toLowerCase()]);
    });

    it('leaves comments the server said nothing about, such as one still being posted', () => {
      const pending = comment('local-c', [ME]);
      const next = applyCommentLikes(activities([pending, comment(COMMENT)]), {
        [COMMENT]: [FRIEND],
      });

      expect(next.a1?.comments[0]).toEqual(pending);
      expect(next.a1?.comments[1]?.likedBy).toEqual([FRIEND]);
    });

    it('returns the same object when nothing changed, so screens do not re-render', () => {
      const before = activities([comment(COMMENT, [FRIEND])]);

      expect(applyCommentLikes(before, { [COMMENT]: [FRIEND] })).toBe(before);
    });
  });

  it('keeps a comment’s likes when the feed is rebuilt from the chain', () => {
    const existing = {
      '0xh1': {
        ...local,
        id: '0xh1',
        activityHash: '0xh1',
        kudos: [],
        comments: [comment(COMMENT, [FRIEND])],
      },
    };

    const { activities: rebuilt } = feedFromChain({
      chain: [chainActivity('0xh1', 1n)],
      local: [],
      existing,
      social: {
        kudos: [],
        comments: [
          {
            id: COMMENT,
            activityId: 1n,
            author: FRIEND,
            text: 'nice',
            createdAt: 1,
            cid: 'c',
          } as never,
        ],
      },
      me: ME,
    });

    expect(rebuilt[0]?.comments[0]?.likedBy).toEqual([FRIEND]);
  });
});
